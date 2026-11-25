// Runs one executor tick by hand and prints the summary (same code as POST /internal/tick).
// Mode comes from EXECUTOR_MODE (default dry: simulates, sends nothing). Reads server/.env via npm script.
import { loadConfig, missingEnv } from '../src/config/env.js';
import { connectDb, ensureIndexes } from '../src/db/index.js';
import { getPublicClient } from '../src/chain/client.js';
import { executorChain } from '../src/chain/executorChain.js';
import { runTick } from '../src/executor/tick.js';

const missing = missingEnv(['BASE_RPC_URL', 'MONGODB_URI', 'SPENDER_ADDRESS']);
if (missing.length) {
  console.error(`missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}
const config = loadConfig();
const { client: mongo, db } = await connectDb(config.mongoUri, 'holdtil');
try {
  await ensureIndexes(db);
  console.log(`executor mode: ${config.executorMode}`);
  const summary = await runTick({ db, chain: executorChain(getPublicClient(config.rpcUrl), { spenderAddress: config.spenderAddress }), config, mode: config.executorMode });
  console.log(JSON.stringify(summary, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
} finally {
  await mongo.close();
}
