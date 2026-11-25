import express from 'express';
import { recoverMessageAddress } from 'viem';
import { CHAIN_ID, ADDRESSES } from './config/addresses.js';
import { HoldtilError } from './errors.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { agentRoutes } from './routes/agents.js';
import { permissionRoutes } from './routes/permissions.js';
import { refillRoutes } from './routes/refills.js';
import { tickRoutes } from './routes/tick.js';
import { proofRoutes } from './routes/proof.js';
import { checkRoutes } from './routes/checks.js';
import { rateLimit } from './rateLimit.js';
import { readBalance } from './chain/balances.js';
import { permissionHash, readPermissionStatus, verifyPermissionSignature } from './chain/spendPermission.js';

/** Chain functions the API uses, bound to one public client. Tests pass their own. */
export function chainDeps(client) {
  return {
    verifySiwe: async ({ address, message, signature }) => {
      // ERC-1271 / ERC-6492 aware (smart wallets, undeployed Base Accounts) — CLAUDE.md §9.
      if (await client.verifyMessage({ address, message, signature })) return true;
      // EIP-7702 accounts (code 0xef0100…) are still controlled by their own key. A plain signature from
      // that key proves control. Only used for sign-in; permissions are checked exactly as the chain will.
      const code = await client.getCode({ address });
      if (!code || !code.toLowerCase().startsWith('0xef0100')) return false;
      const recovered = await recoverMessageAddress({ message, signature });
      return recovered.toLowerCase() === address.toLowerCase();
    },
    verifyPermissionSignature: (p, sig) => verifyPermissionSignature(client, p, sig),
    permissionHash,
    readPermissionStatus: (p, nowSec) => readPermissionStatus(client, p, nowSec),
    readUsdcBalance: (addr) => readBalance(client, ADDRESSES.USDC, addr),
  };
}

/**
 * @param {{ db?: import('mongodb').Db, config?: object, chain?: object }} deps
 * Without a db only /health works (used by the basic API test).
 */
export function createApp({ db, config, chain, executorChain } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config?.trustProxyHops ?? 1);
  app.use(express.json({ limit: '32kb' }));

  // PRD §14: GET /health
  // Also a keep-alive: cron-job.org calls it on a schedule. It wakes the Render service and pings MongoDB,
  // so the Atlas free cluster always sees activity and is never paused for inactivity (owner 2026-11-25).
  app.get('/health', async (_req, res) => {
    const body = { status: 'ok', network: 'base-mainnet', chainId: CHAIN_ID };
    if (db) {
      try {
        await db.command({ ping: 1 });
        body.db = 'ok';
      } catch {
        body.status = 'degraded';
        body.db = 'unavailable';
      }
    }
    res.status(body.status === 'ok' ? 200 : 503).json(body);
  });

  // API answers are per user and live; no proxy or CDN may cache them (the Vercel rewrite caches by default).
  app.use(['/v1', '/internal'], (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  if (db) {
    // PRD §12: rate limits on auth and write endpoints (per IP, per minute). Tests can loosen them via config.
    const limits = config?.rateLimits ?? {};
    const write = ['POST', 'PATCH', 'PUT', 'DELETE'];
    app.use('/v1/auth', rateLimit({ windowMs: 60_000, max: limits.auth ?? 20 }));
    // Checkpoint C #5: a shared cap too, since per-IP keys can be faked by calling Render directly.
    app.use('/v1/auth', rateLimit({ windowMs: 60_000, max: limits.authGlobal ?? 300, global: true }));
    app.use('/v1', rateLimit({ windowMs: 60_000, max: limits.read ?? 120, methods: ['GET'] }));
    // Checkpoint C #9: a browser always sends Origin on cross-site writes. Refuse any that isn't the app.
    app.use('/v1', (req, _res, next) => {
      const origin = req.get('origin');
      if (write.includes(req.method) && origin && config?.appOrigin && origin !== config.appOrigin) {
        return next(new HoldtilError('auth_failed', 'Request from another site refused', { status: 403 }));
      }
      next();
    });
    app.use('/v1', rateLimit({ windowMs: 60_000, max: limits.write ?? 30, methods: write }));
    app.use('/v1/proof', rateLimit({ windowMs: 60_000, max: limits.proof ?? 60 }));
    app.use('/internal/tick', rateLimit({ windowMs: 60_000, max: limits.internal ?? 10 }));
    // Fair-price check records come from Bankr's shared servers (one IP for many payers), so one shared cap.
    app.use('/internal/checks', rateLimit({ windowMs: 60_000, max: limits.checks ?? 120, global: true }));
    app.use('/v1/auth', authRoutes({ db, config, chain }));
    app.use('/v1/me', meRoutes({ db, config }));
    app.use('/v1/agents', agentRoutes({ db, chain }));
    app.use('/v1/permissions', permissionRoutes({ db, config, chain }));
    app.use('/v1/refills', refillRoutes({ db }));
    app.use('/v1/proof', proofRoutes({ db, config, chain }));
    app.use('/internal', tickRoutes({ db, config, executorChain }));
    app.use('/internal', checkRoutes({ db, config }));
  }

  app.use((_req, _res, next) => next(new HoldtilError('not_found', 'Route not found', { status: 404 })));

  // Express 5 sends rejected async handlers here too.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HoldtilError) return res.status(err.status).json({ error: err.toJSON() });
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
      const e = new HoldtilError('invalid_input', 'Bad request body', { status: 400 });
      return res.status(400).json({ error: e.toJSON() });
    }
    console.error('[error]', err?.message);
    const e = new HoldtilError('internal_error', 'Something went wrong', { status: 500 });
    return res.status(500).json({ error: e.toJSON() });
  });

  return app;
}
