// Shared setup for API tests: in-memory MongoDB (never a real DB) + a fake chain that checks
// signatures with plain ECDSA (local test keys). Real smart-wallet checks are covered by fork tests.
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import request from 'supertest';
import { verifyMessage, verifyTypedData } from 'viem';
import { createSiweMessage } from 'viem/siwe';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../../src/app.js';
import { ensureIndexes } from '../../src/db/index.js';
import { permissionHash, spendPermissionTypedData } from '../../src/chain/spendPermission.js';
import { STOCKS } from '../../src/config/addresses.js';

export const SPENDER = '0xb7F3c5F916359B303d3ecEbB39f47969444fd15B';
export const config = {
  appOrigin: 'http://localhost:5173',
  appDomain: 'localhost:5173',
  spenderAddress: SPENDER,
  cookieSecure: false,
};

export async function startDb() {
  const mongod = await MongoMemoryServer.create();
  const client = await MongoClient.connect(mongod.getUri());
  const db = client.db('holdtil_test');
  await ensureIndexes(db);
  return { mongod, client, db, stop: async () => { await client.close(); await mongod.stop(); } };
}

export function fakeChain(overrides = {}) {
  const state = { revoked: new Set(), spent: 0n, balances: new Map(), fail: false };
  const chain = {
    state,
    verifySiwe: ({ address, message, signature }) => verifyMessage({ address, message, signature }),
    verifyPermissionSignature: (p, signature) => verifyTypedData({ address: p.account, ...spendPermissionTypedData(p), signature }),
    permissionHash,
    readPermissionStatus: async (p, nowSec) => {
      if (state.fail) throw new Error('rpc down');
      if (state.revoked.has(permissionHash(p))) return { status: 'revoked', remaining: 0n, spentThisPeriod: null };
      if (nowSec >= BigInt(p.end)) return { status: 'expired', remaining: 0n, spentThisPeriod: null };
      return { status: 'active', remaining: p.allowance - state.spent, spentThisPeriod: state.spent };
    },
    readUsdcBalance: async (addr) => {
      if (state.fail) throw new Error('rpc down');
      return state.balances.get(addr) ?? 0n;
    },
    ...overrides,
  };
  return chain;
}

export function makeApp(db, chain = fakeChain()) {
  return { app: createApp({ db, config, chain }), chain };
}

export const newUser = () => privateKeyToAccount(generatePrivateKey());

export async function siweFor(app, account, patch = {}) {
  const { body } = await request(app).get('/v1/auth/nonce');
  const message = createSiweMessage({
    address: account.address,
    chainId: 8453,
    domain: config.appDomain,
    nonce: body.nonce,
    uri: config.appOrigin,
    version: '1',
    issuedAt: new Date(),
    statement: 'Sign in to Holdtil',
    ...patch,
  });
  const signature = await account.signMessage({ message });
  return { address: account.address, message, signature };
}

/** Signs in and returns a supertest agent that keeps the session cookie. */
export async function signIn(app, account, { onboard = true } = {}) {
  const agent = request.agent(app);
  const payload = await siweFor(app, account);
  const res = await agent.post('/v1/auth/verify').send(payload);
  if (res.status !== 200) throw new Error(`sign-in failed: ${JSON.stringify(res.body)}`);
  if (onboard) await agent.post('/v1/me/onboard').send({ notUs: true, terms: true });
  return agent;
}

export async function signedPermission(account, patch = {}) {
  const now = Math.floor(Date.now() / 1000);
  const permission = {
    account: account.address,
    spender: SPENDER,
    token: STOCKS.NVDAc.address,
    allowance: 2_000_000n,
    period: 86_400,
    start: now - 60,
    end: now + 30 * 86_400,
    salt: 1n,
    extraData: '0x',
    ...patch,
  };
  const signature = await account.signTypedData(spendPermissionTypedData(permission));
  return {
    permission: { ...permission, allowance: permission.allowance.toString(), salt: permission.salt.toString() },
    signature,
  };
}
