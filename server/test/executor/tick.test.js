// Executor tests on in-memory MongoDB with a fake chain (no network). Covers the break-it lab
// (PRD §18 #1–7) at the decision level; real-chain batch behaviour is in test/fork/executor.fork.test.js.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { decodeFunctionData, getAddress } from 'viem';
import { startDb, makeApp, newUser, signIn, signedPermission, fakeChain, config as baseConfig, SPENDER } from '../api/helpers.js';
import { runTick, tickIdFor } from '../../src/executor/tick.js';
import { buildRefillCalls } from '../../src/chain/refillBatch.js';
import { routerAbi } from '../../src/chain/abis.js';
import { ADDRESSES, STOCKS } from '../../src/config/addresses.js';
import { createApp } from '../../src/app.js';
import { REFILLS } from '../../src/db/refills.js';

const PRICE = 150_00000000n; // $150, 8 decimals
let env;
let app;
let chain;

/** Fake executor chain. quoteFactorBps scales the quote vs the reference (10000 = same price). */
function fakeExecutor(base, opts = {}) {
  const s = { nowSec: BigInt(Math.floor(Date.now() / 1000)), refAgeSec: 60n, quoteFactorBps: 10_000n, sends: [], approved: false, beforeSend: null, simulateOk: true, ...opts };
  const ex = {
    s,
    blockTime: async () => s.nowSec,
    readUsdcBalance: base.readUsdcBalance,
    readPermissionStatus: base.readPermissionStatus,
    readReference: async () => ({ answer: PRICE, updatedAt: s.nowSec - s.refAgeSec, decimals: 8, roundId: 5n, answeredInRound: 5n }),
    quoteSell: async (_stock, amount) => ({ amountOut: (amount * PRICE * 10n ** 6n * s.quoteFactorBps) / (10n ** 8n * 10n ** 8n * 10_000n) }),
    isApproved: async () => s.approved,
    simulateRefill: async ({ calls }) => {
      s.lastSimCalls = calls;
      if (s.beforeSend) await s.beforeSend();
      if (!s.simulateOk) return { ok: false, error: 'reverted' };
      const swap = decodeFunctionData({ abi: routerAbi, data: calls.at(-1).data });
      return { ok: true, usdcOut: swap.args[0].amountOutMinimum + 1000n };
    },
    sendRefill: async ({ calls, idempotencyKey }) => {
      s.sends.push({ calls, idempotencyKey });
      return { userOpHash: `0x${String(s.sends.length).padStart(64, 'a')}` };
    },
    checkRefill: async () => ({ status: 'complete', txHash: `0x${'b'.repeat(64)}`, usdcOut: 1_900_000n }),
  };
  return ex;
}

async function setupUser({ permission = true } = {}) {
  const me = newUser();
  const a = await signIn(app, me);
  const wallet = newUser().address;
  const res = await a.post('/v1/agents').send({ name: 'Bot', walletAddress: wallet });
  if (permission) await a.post('/v1/permissions').send(await signedPermission(me));
  return { me, a, agentId: res.body.agent.id, wallet };
}

const live = (ex, now = new Date()) => runTick({ db: env.db, chain: ex, config: baseConfig, mode: 'live', now });
const dry = (ex, now = new Date()) => runTick({ db: env.db, chain: ex, config: baseConfig, mode: 'dry', now });
const refillsOf = (agentId) => env.db.collection(REFILLS).find({ agentId }).sort({ createdAt: 1 }).toArray();
const resultFor = (summary, agentId) => summary.agents.find((x) => x.agentId === agentId);

beforeAll(async () => {
  env = await startDb();
  ({ app, chain } = makeApp(env.db, fakeChain()));
});
afterAll(() => env?.stop());
beforeEach(async () => {
  // Each test gets a clean slate of agents/refills so other users' agents don't interfere.
  await Promise.all(['agents', 'refills', 'permissions', 'settings'].map((c) => env.db.collection(c).deleteMany({})));
  chain.state.revoked.clear();
  chain.state.spent = 0n;
  chain.state.fail = false;
});

describe('executor happy paths', () => {
  it('dry run: checks + simulation pass, logs dry_run, sends nothing', async () => {
    const { agentId } = await setupUser();
    const ex = fakeExecutor(chain);
    const sum = await dry(ex);
    expect(resultFor(sum, agentId)).toMatchObject({ result: 'waited', code: 'dry_run' });
    expect(ex.s.sends).toHaveLength(0);
    const [r] = await refillsOf(agentId);
    expect(r).toMatchObject({ state: 'waited', code: 'dry_run', mode: 'dry' });
    expect(r.history.map((h) => h.to)).toEqual(['planned', 'checked', 'simulated', 'waited']);
    expect(r.inFlight).toBeUndefined();
    expect(BigInt(r.simulatedUsdcOut)).toBeGreaterThanOrEqual(BigInt(r.minOut));
  });

  it('live: sends once to the DB agent wallet, saves the hash, confirms with a receipt', async () => {
    const { agentId, wallet } = await setupUser();
    const ex = fakeExecutor(chain);
    const sum = await live(ex);
    expect(resultFor(sum, agentId)).toMatchObject({ result: 'confirmed', txHash: `0x${'b'.repeat(64)}` });
    expect(ex.s.sends).toHaveLength(1);
    const calls = ex.s.sends[0].calls;
    // first time: approveWithSignature + spend + approve(router) + swap
    expect(calls.map((c) => getAddress(c.to))).toEqual([ADDRESSES.SPEND_PERMISSION_MANAGER, ADDRESSES.SPEND_PERMISSION_MANAGER, STOCKS.NVDAc.address, ADDRESSES.AERO_CL_SWAP_ROUTER].map((x) => getAddress(x)));
    const swap = decodeFunctionData({ abi: routerAbi, data: calls[3].data }).args[0];
    expect(getAddress(swap.recipient)).toBe(getAddress(wallet)); // INV-5
    expect(swap.amountOutMinimum).toBeGreaterThan(0n);
    const [r] = await refillsOf(agentId);
    expect(r).toMatchObject({ state: 'confirmed', usdcOut: '1900000', userOpHash: ex.s.sends.length && `0x${'1'.padStart(64, 'a')}` });
    expect(ex.s.sends[0].idempotencyKey).toBe(r.refillId);
  });

  it('no refill when the float is above the floor', async () => {
    const { agentId, wallet } = await setupUser();
    chain.state.balances.set(wallet, 2_000_000n);
    const sum = await dry(fakeExecutor(chain));
    expect(resultFor(sum, agentId)).toMatchObject({ result: 'not_needed' });
    expect(await refillsOf(agentId)).toHaveLength(0);
    chain.state.balances.delete(wallet);
  });

  it('after approval, the batch skips approveWithSignature', async () => {
    await setupUser();
    const ex = fakeExecutor(chain, { approved: true });
    await live(ex);
    expect(ex.s.sends[0].calls).toHaveLength(3);
  });
});

describe('break-it lab (PRD §18)', () => {
  it('#1 pool far from reference → price_gap_too_wide, no tx', async () => {
    const { agentId } = await setupUser();
    const ex = fakeExecutor(chain, { quoteFactorBps: 9_700n }); // 3% below reference
    const sum = await live(ex);
    expect(resultFor(sum, agentId)).toMatchObject({ result: 'waited', code: 'price_gap_too_wide' });
    expect(ex.s.sends).toHaveLength(0);
  });

  it('#2 stale reference (weekend) → price_stale, no tx', async () => {
    const { agentId } = await setupUser();
    const ex = fakeExecutor(chain, { refAgeSec: 2n * 86_400n });
    const sum = await live(ex);
    expect(resultFor(sum, agentId)).toMatchObject({ result: 'waited', code: 'price_stale' });
    expect(ex.s.sends).toHaveLength(0);
  });

  it('#3 over the daily limit → limit_exceeded, no tx', async () => {
    const { agentId } = await setupUser();
    await env.db.collection(REFILLS).insertOne({ refillId: 'old1', agentId, state: 'confirmed', usdcOut: '4500000', plannedUsdc: '4500000', createdAt: new Date() });
    const ex = fakeExecutor(chain);
    const sum = await live(ex);
    expect(resultFor(sum, agentId)).toMatchObject({ result: 'blocked', code: 'limit_exceeded' });
    expect(ex.s.sends).toHaveLength(0);
  });

  it('#4 two ticks at the same moment → exactly one refill', async () => {
    const { agentId } = await setupUser();
    const ex = fakeExecutor(chain);
    const now = new Date();
    const [s1, s2] = await Promise.all([live(ex, now), live(ex, now)]);
    expect(ex.s.sends).toHaveLength(1);
    const results = [resultFor(s1, agentId), resultFor(s2, agentId)].map((r) => r.result).sort();
    expect(results).toEqual(['confirmed', 'skipped']);
    expect((await refillsOf(agentId)).filter((r) => r.state === 'confirmed')).toHaveLength(1);
  });

  it('#5 permission revoked → permission_revoked, no tx', async () => {
    const { agentId } = await setupUser();
    const p = (await env.db.collection('permissions').findOne({})).permissionHash;
    chain.state.revoked.add(p);
    const ex = fakeExecutor(chain);
    const sum = await live(ex);
    expect(resultFor(sum, agentId)).toMatchObject({ result: 'blocked', code: 'permission_revoked' });
    expect(ex.s.sends).toHaveLength(0);
  });

  it('#5b no permission at all → permission_revoked, no tx', async () => {
    const { agentId } = await setupUser({ permission: false });
    const ex = fakeExecutor(chain);
    expect(resultFor(await live(ex), agentId)).toMatchObject({ code: 'permission_revoked' });
    expect(ex.s.sends).toHaveLength(0);
  });

  it('#6 owner presses Stop → paused, no tx; global pause and agent pause too', async () => {
    const { a, agentId } = await setupUser();
    const ex = fakeExecutor(chain);
    await a.post('/v1/me/stop');
    expect(resultFor(await live(ex), agentId)).toMatchObject({ result: 'skipped', code: 'paused' });
    await a.post('/v1/me/resume');
    await env.db.collection('settings').updateOne({ _id: 'global' }, { $set: { globalPause: true } }, { upsert: true });
    expect(await live(ex)).toMatchObject({ paused: true, agents: [] });
    await env.db.collection('settings').deleteMany({});
    await a.patch(`/v1/agents/${agentId}`).send({ status: 'paused' });
    expect(resultFor(await live(ex), agentId)).toBeUndefined(); // paused agents are not even loaded
    expect(ex.s.sends).toHaveLength(0);
  });

  it('#6b Stop pressed between simulation and send → blocked paused, no tx', async () => {
    const { me, agentId } = await setupUser();
    const ex = fakeExecutor(chain, {
      beforeSend: async () => env.db.collection('users').updateOne({ address: me.address.toLowerCase() }, { $set: { stoppedAt: new Date() } }),
    });
    expect(resultFor(await live(ex), agentId)).toMatchObject({ result: 'blocked', code: 'paused' });
    expect(ex.s.sends).toHaveLength(0);
  });

  it('#7 destination cannot be changed: API refuses, batch builder refuses anything but an agent wallet', async () => {
    const { a, agentId, me } = await setupUser();
    const res = await a.patch(`/v1/agents/${agentId}`).send({ walletAddress: newUser().address });
    expect(res.status).toBe(400);
    const doc = await env.db.collection('permissions').findOne({});
    const { fromDb } = await import('../../src/routes/permissions.js');
    const permission = fromDb(doc.permission);
    const args = { stock: STOCKS.NVDAc, permission, signature: doc.signature, needsApproval: false, stockAmount: 1000n, minOut: 1n, deadline: 9_999_999_999n, spender: SPENDER };
    for (const recipient of [me.address, SPENDER, ADDRESSES.AERO_CL_SWAP_ROUTER, ADDRESSES.USDC, STOCKS.NVDAc.pool.address, 'nope']) {
      expect(() => buildRefillCalls({ ...args, recipient })).toThrow();
    }
    expect(() => buildRefillCalls({ ...args, recipient: newUser().address })).not.toThrow();
  });
});

describe('failure handling', () => {
  it('simulation fails → waited simulation_failed, agent unlocked', async () => {
    const { agentId } = await setupUser();
    const ex = fakeExecutor(chain, { simulateOk: false });
    expect(resultFor(await live(ex), agentId)).toMatchObject({ result: 'waited', code: 'simulation_failed' });
    const [r] = await refillsOf(agentId);
    expect(r.inFlight).toBeUndefined();
    expect(ex.s.sends).toHaveLength(0);
  });

  it('pending user op stays sent (locked) and the next tick settles it', async () => {
    const { agentId } = await setupUser();
    const ex = fakeExecutor(chain);
    ex.checkRefill = async () => ({ status: 'pending' });
    const t0 = new Date();
    expect(resultFor(await live(ex, t0), agentId)).toMatchObject({ result: 'sent' });
    // Still locked: a new tick does not send again.
    ex.checkRefill = async () => ({ status: 'pending' });
    await live(ex, new Date(t0.getTime() + 300_000));
    expect(ex.s.sends).toHaveLength(1);
    ex.checkRefill = async () => ({ status: 'complete', txHash: `0x${'c'.repeat(64)}`, usdcOut: 1_950_000n });
    const sum = await live(ex, new Date(t0.getTime() + 600_000));
    expect(sum.recovered.settled[0]).toMatchObject({ state: 'confirmed' });
    expect((await refillsOf(agentId))[0]).toMatchObject({ state: 'confirmed', usdcOut: '1950000' });
  });

  it('included but no USDC reached the agent → failed tx_failed', async () => {
    const { agentId } = await setupUser();
    const ex = fakeExecutor(chain);
    ex.checkRefill = async () => ({ status: 'complete', txHash: `0x${'d'.repeat(64)}`, usdcOut: 0n });
    expect(resultFor(await live(ex), agentId)).toMatchObject({ result: 'failed' });
  });

  it('send throws after marking sent → stays sent with no hash (locked, never resent)', async () => {
    const { agentId } = await setupUser();
    const ex = fakeExecutor(chain);
    ex.sendRefill = async () => {
      throw new Error('network');
    };
    await live(ex);
    const [r] = await refillsOf(agentId);
    expect(r).toMatchObject({ state: 'sent', inFlight: true });
    expect(r.userOpHash).toBeUndefined();
    const sum = await live(ex, new Date(Date.now() + 300_000));
    expect(sum.recovered.settled[0].note).toMatch(/no hash/);
  });

  it('same reason is logged once an hour, not every tick', async () => {
    const { agentId } = await setupUser();
    const ex = fakeExecutor(chain, { refAgeSec: 99_999n });
    const t0 = new Date();
    await live(ex, t0);
    await live(ex, new Date(t0.getTime() + 300_000));
    expect(await refillsOf(agentId)).toHaveLength(1);
    await live(ex, new Date(t0.getTime() + 3_700_000));
    expect(await refillsOf(agentId)).toHaveLength(2);
  });

  it('chain down → no sale', async () => {
    const { agentId } = await setupUser();
    chain.state.fail = true;
    const ex = fakeExecutor(chain);
    const sum = await live(ex);
    expect(resultFor(sum, agentId)).toMatchObject({ result: 'error' });
    expect(ex.s.sends).toHaveLength(0);
  });

  it('tickIdFor buckets by 5 minutes', () => {
    expect(tickIdFor(new Date(0))).toBe(tickIdFor(new Date(299_999)));
    expect(tickIdFor(new Date(0))).not.toBe(tickIdFor(new Date(300_000)));
  });
});

describe('API: /internal/tick and /v1/refills', () => {
  it('tick needs the secret; runs in the configured mode', async () => {
    const ex = fakeExecutor(chain);
    const tickApp = createApp({ db: env.db, config: { ...baseConfig, tickSecret: 'test-secret', executorMode: 'dry' }, chain, executorChain: ex });
    expect((await request(tickApp).post('/internal/tick')).status).toBe(401);
    expect((await request(tickApp).post('/internal/tick').set('x-tick-secret', 'wrong')).status).toBe(401);
    const { agentId } = await setupUser();
    const ok = await request(tickApp).post('/internal/tick').set('x-tick-secret', 'test-secret');
    expect(ok.status).toBe(200);
    expect(ok.body.mode).toBe('dry');
    expect(ok.body.agents.find((x) => x.agentId === agentId)).toMatchObject({ code: 'dry_run' });
    expect(ex.s.sends).toHaveLength(0);
  });

  it('refills list shows own receipts only', async () => {
    const { a, agentId } = await setupUser();
    await live(fakeExecutor(chain));
    const res = await a.get('/v1/refills');
    expect(res.status).toBe(200);
    expect(res.body.refills[0]).toMatchObject({ agentId, state: 'confirmed', usdcOut: '1900000', txHash: `0x${'b'.repeat(64)}` });
    const other = await signIn(app, newUser());
    expect((await other.get('/v1/refills')).body.refills).toHaveLength(0);
    expect((await other.get(`/v1/refills?agentId=${agentId}`)).status).toBe(404);
  });
});
