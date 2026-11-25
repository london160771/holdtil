// Reads env vars. Never logs or returns secret values (CLAUDE.md §6).

const REQUIRED_FOR_SERVER = ['BASE_RPC_URL', 'MONGODB_URI', 'SESSION_SECRET', 'TICK_SECRET', 'APP_ORIGIN', 'SPENDER_ADDRESS'];

/** Names of required env vars that are missing. Values are never returned. */
export function missingEnv(names = REQUIRED_FOR_SERVER, env = process.env) {
  return names.filter((n) => !env[n] || String(env[n]).trim() === '');
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
    // Refill executor: 'dry' (default; simulates, sends nothing) unless the owner sets EXECUTOR_MODE=live.
    executorMode: env.EXECUTOR_MODE === 'live' ? 'live' : 'dry',
  };
}
