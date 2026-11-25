import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startDb, newUser, signIn, fakeChain, config } from './helpers.js';
import { createApp } from '../../src/app.js';
import { REFILLS } from '../../src/db/refills.js';

let env;
const scout = newUser().address;
let app;
let chain;
beforeAll(async () => {
  env = await startDb();
  chain = fakeChain();
  app = createApp({ db: env.db, config: { ...config, scoutAddress: scout }, chain });
});
afterAll(() => env?.stop());

describe('GET /v1/proof (public)', () => {
  it('works without login and shows only real stored data', async () => {
    const res = await request(app).get('/v1/proof');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ scout: { address: scout, usdcBalance: '0' }, payments: [], refills: [], totals: { payments: 0, refills: 0 } });
  });

  it("shows Scout's payments and the refills of Scout's agent only, without user ids", async () => {
    const owner = newUser();
    const a = await signIn(app, owner);
    const sa = (await a.post('/v1/agents').send({ name: 'Scout', walletAddress: scout.toLowerCase() })).body.agent;
    const other = (await a.post('/v1/agents').send({ name: 'Other', walletAddress: newUser().address })).body.agent;
    const TX = `0x${'c'.repeat(64)}`;
    await env.db.collection(REFILLS).insertMany([
      { refillId: 'p1', agentId: sa.id, state: 'confirmed', usdcOut: '988785', txHash: TX, createdAt: new Date(), history: [] },
      { refillId: 'p2', agentId: other.id, state: 'confirmed', usdcOut: '5', createdAt: new Date(), history: [] },
    ]);
    await env.db.collection('scoutRuns').insertMany([
      { runId: 'r1', status: 'paid', costUsdc: '30000', x402TxHash: `0x${'d'.repeat(64)}`, summary: 'US market open', createdAt: new Date() },
      { runId: 'r2', status: 'pending', costUsdc: '30000', createdAt: new Date() },
    ]);
    chain.state.balances.set(scout, 1_500_000n);
    const res = await request(app).get('/v1/proof');
    expect(res.body.refills).toHaveLength(1);
    expect(res.body.refills[0]).toMatchObject({ state: 'confirmed', usdcOut: '988785', txHash: TX });
    expect(res.body.refills[0].agentId).toBeUndefined();
    expect(res.body.payments).toEqual([expect.objectContaining({ status: 'paid', costUsdc: '30000', summary: 'US market open' })]);
    expect(res.body.totals).toMatchObject({ payments: 1, paidUsdc: '30000', refills: 1, refilledUsdc: '988785' });
    expect(res.body.scout.usdcBalance).toBe('1500000');
    expect(JSON.stringify(res.body)).not.toContain(owner.address.toLowerCase());
  });

  it('chain down → balance "unavailable", never a guess', async () => {
    chain.state.fail = true;
    const res = await request(app).get('/v1/proof');
    expect(res.body.scout.usdcBalance).toBe('unavailable');
    chain.state.fail = false;
  });
});
