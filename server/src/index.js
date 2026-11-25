import { createApp, chainDeps } from './app.js';
import { loadConfig, missingEnv } from './config/env.js';
import { connectDb, ensureIndexes } from './db/index.js';
import { getPublicClient } from './chain/client.js';
import { executorChain } from './chain/executorChain.js';

const config = loadConfig();
const missing = missingEnv();
if (missing.length) {
  // Names only, never values. Fail closed: the API does not start half-configured.
  console.error(`[startup] missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const { db } = await connectDb(config.mongoUri, 'holdtil');
await ensureIndexes(db);
const client = getPublicClient(config.rpcUrl);
const app = createApp({ db, config, chain: chainDeps(client), executorChain: executorChain(client, { spenderAddress: config.spenderAddress, dataSuffix: config.dataSuffix }) });
console.log(`[startup] executor mode: ${config.executorMode}`);
app.listen(config.port, () => {
  console.log(`[startup] Holdtil API listening on :${config.port}`);
});
