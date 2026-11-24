// Reads env vars. Never logs or returns secret values (CLAUDE.md §6).

const REQUIRED_FOR_SERVER = ['BASE_RPC_URL', 'SESSION_SECRET', 'TICK_SECRET'];

/** Names of required env vars that are missing. Values are never returned. */
export function missingEnv(names = REQUIRED_FOR_SERVER, env = process.env) {
  return names.filter((n) => !env[n] || String(env[n]).trim() === '');
}

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3001),
    rpcUrl: env.BASE_RPC_URL || '',
    nodeEnv: env.NODE_ENV || 'development',
  };
}
