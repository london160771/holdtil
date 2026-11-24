import express from 'express';
import { CHAIN_ID } from './config/addresses.js';
import { HoldtilError } from './errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  // PRD §14: GET /health
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', network: 'base-mainnet', chainId: CHAIN_ID });
  });

  app.use((_req, _res, next) => next(new HoldtilError('not_found', 'Route not found', { status: 404 })));

  // Express 5 sends rejected async handlers here too.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HoldtilError) return res.status(err.status).json({ error: err.toJSON() });
    console.error('[error]', err?.message);
    const e = new HoldtilError('internal_error', 'Something went wrong', { status: 500 });
    return res.status(500).json({ error: e.toJSON() });
  });

  return app;
}
