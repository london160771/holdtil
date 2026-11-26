// Reads env vars. Never logs or returns secret values (CLAUDE.md §6).
import { builderCodeSuffix } from '../chain/builderCode.js';

const REQUIRED_FOR_SERVER = ['BASE_RPC_URL', 'MONGODB_URI', 'SESSION_SECRET', 'TICK_SECRET', 'APP_ORIGIN', 'SPENDER_ADDRESS'];

/** Names of required env vars that are missing. Values are never returned. */
export function missingEnv(names = REQUIRED_FOR_SERVER, env = process.env) {
  return names.filter((n) => !env[n] || String(env[n]).trim() === '');
}

export const MAX_GAS_FEE_USDC = 50_000n;

function gasFee(v) {
  const t = (v ?? '').trim();
  if (t === '') return 20_000n;
  if (!/^\d+$/.test(t) || BigInt(t) > MAX_GAS_FEE_USDC) throw new Error('GAS_FEE_USDC must be USDC base units from 0 to 50000 ($0.05), e.g. 20000');
  return BigInt(t);
}

function feeWallet(v) {
  const t = (v ?? '').trim();
  if (t === '') return '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(t)) throw new Error('FEE_WALLET must be a 0x address on Base');
  return t;
}

export function loadConfig(env = process.env) {
  const appOrigin = env.APP_ORIGIN || 'http://localhost:5173';
  return {
    port: Number(env.PORT || 3001),
    rpcUrl: env.BASE_RPC_URL || '',
    mongoUri: env.MONGODB_URI || '',
    nodeEnv: env.NODE_ENV || 'development',
    // Sign in with Base: the SIWE message must name this exact origin (PRD FR-AUTH-001).
    appOrigin,
    appDomain: new URL(appOrigin).host,
    // Public address of Holdtil's spender smart account (not a secret).
    spenderAddress: env.SPENDER_ADDRESS || '',
    // Cookies are Secure on https. The client reaches the API through the same origin (Vercel rewrite), so SameSite=Lax.
    cookieSecure: appOrigin.startsWith('https://'),
    tickSecret: env.TICK_SECRET || '',
    // Proxies in front of the API: 1 locally / Render alone, 2 behind the Vercel rewrite (Vercel + Render).
    // Express then takes the client IP from X-Forwarded-For for rate limits.
    trustProxyHops: /^[0-3]$/.test(env.TRUST_PROXY_HOPS || '') ? Number(env.TRUST_PROXY_HOPS) : 1,
    // Holdtil Scout's public wallet address, shown on /proof (not a secret).
    scoutAddress: env.SCOUT_ADDRESS || '',
    // Refill executor: 'dry' (default; simulates, sends nothing) unless the owner sets EXECUTOR_MODE=live.
    executorMode: env.EXECUTOR_MODE === 'live' ? 'live' : 'dry',
    // Who gets real refills in live mode: LIVE_USER_ADDRESSES=* means every user (rollout step 5, each under
    // their own limits); a comma list means only those accounts (step 4). Everyone else stays dry.
    liveAll: (env.LIVE_USER_ADDRESSES || '').trim() === '*',
    liveUsers: (env.LIVE_USER_ADDRESSES || '').split(',').map((a) => a.trim()).filter((a) => /^0x[0-9a-fA-F]{40}$/.test(a)),
    // Site-wide emergency cap per refill, gas fee included (USDC base units). Default $25 (PRD FR-RFL-006).
    liveMaxRefillUsdc: /^\d+$/.test(env.LIVE_MAX_REFILL_USDC || '') ? BigInt(env.LIVE_MAX_REFILL_USDC) : 25_000_000n,
    // User-paid gas fee per refill (USDC base units), sold from the user's stock to FEE_WALLET in the same batch.
    // Default $0.02, max $0.05. Live refills are refused while the fee is on and FEE_WALLET is empty.
    gasFeeUsdc: gasFee(env.GAS_FEE_USDC),
    feeWallet: feeWallet(env.FEE_WALLET),
    // Base Builder Code (public, from Base Dashboard). Tags refill user ops for attribution (ERC-8021). Empty = no tag.
    // A malformed code stops the server at start instead of being silently dropped.
    // Fair-price check on Bankr (FR-FPC-001): shared secret for POST /internal/checks, and the public endpoint URL
    // (https://x402.bankr.bot/<payout wallet>/fair-price) shown on /proof.
    checkSecret: env.CHECK_SECRET || '',
    fairPriceUrl: /^https:\/\/x402\.bankr\.bot\/0x[0-9a-fA-F]{40}\/[A-Za-z0-9_-]{1,47}$/.test(env.FAIR_PRICE_URL || '') ? env.FAIR_PRICE_URL : '',
    builderCode: (env.BUILDER_CODE || '').trim(),
    dataSuffix: builderCodeSuffix(env.BUILDER_CODE),
  };
}
