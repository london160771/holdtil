// Runs Scout once, or every SCOUT_INTERVAL_MIN minutes with --loop. Reads scout/.env via the npm script.
// Env: SCOUT_PRIVATE_KEY (Scout's own wallet; never printed), MONGODB_URI, SCOUT_MODE (dry|live, default dry),
// SCOUT_DAILY_MAX_USDC (atomic, default 300000 = $0.30), SCOUT_INTERVAL_MIN (default 60).
import { MongoClient } from 'mongodb';
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';
import { runOnce, BASE, LIMITS } from './scout.js';

const missing = ['SCOUT_PRIVATE_KEY', 'MONGODB_URI'].filter((n) => !process.env[n]);
if (missing.length) {
  console.error(`missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}
const account = privateKeyToAccount(process.env.SCOUT_PRIVATE_KEY);
const mode = process.env.SCOUT_MODE === 'live' ? 'live' : 'dry';
const dailyMaxAtomic = /^\d+$/.test(process.env.SCOUT_DAILY_MAX_USDC ?? '') ? BigInt(process.env.SCOUT_DAILY_MAX_USDC) : LIMITS.defaultDailyAtomic;
const intervalMin = Math.max(5, Number(process.env.SCOUT_INTERVAL_MIN ?? 60) || 60);

const mongo = await MongoClient.connect(process.env.MONGODB_URI);
const db = mongo.db('holdtil');
await db.collection('scoutRuns').createIndex({ runId: 1 }, { unique: true });
await db.collection('scoutRuns').createIndex({ createdAt: -1 });

const makePaidFetch = (selector) =>
  wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: BASE, client: new ExactEvmScheme(account) }], paymentRequirementsSelector: selector });

async function once() {
  try {
    const r = await runOnce({ db, makePaidFetch, decodePaymentResponse: decodePaymentResponseHeader, payer: account.address, mode, dailyMaxAtomic });
    console.log(JSON.stringify({ at: new Date().toISOString(), scout: account.address, ...r }));
  } catch (e) {
    console.error(JSON.stringify({ at: new Date().toISOString(), scout: account.address, error: e.message }));
    process.exitCode = 1;
  }
}

console.log(`scout ${account.address} mode: ${mode}`);
if (process.argv.includes('--loop')) {
  await once();
  setInterval(once, intervalMin * 60_000);
} else {
  await once();
  await mongo.close();
}
