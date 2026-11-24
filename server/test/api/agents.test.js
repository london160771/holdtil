import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startDb, makeApp, newUser, signIn } from './helpers.js';
import { STOCKS } from '../../src/config/addresses.js';

let env;
let app;
let chain;
beforeAll(async () => {
  env = await startDb();
  ({ app, chain } = makeApp(env.db));
});
afterAll(() => env?.stop());

const wallet = () => newUser().address;

describe('agents (FR-AGT-001)', () => {
  it('cannot add an agent before onboarding', async () => {
    const a = await signIn(app, newUser(), { onboard: false });
    const res = await a.post('/v1/agents').send({ name: 'Scout', walletAddress: wallet() });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('onboarding_required');
  });

  it('adds with default limits and shows the live balance', async () => {
    const a = await signIn(app, newUser());
    const w = wallet();
    chain.state.balances.set(w, 1_500_000n);
    const res = await a.post('/v1/agents').send({ name: 'Scout', walletAddress: w.toLowerCase() });
    expect(res.status).toBe(201);
    expect(res.body.agent).toMatchObject({ name: 'Scout', walletAddress: w, floorUsdc: '1000000', targetUsdc: '3000000', maxPerRefillUsdc: '2000000', dailyLimitUsdc: '5000000', status: 'active' });
    const list = await a.get('/v1/agents');
    expect(list.body.agents[0].usdcBalance).toBe('1500000');
  });

  it('shows "unavailable" when the chain read fails', async () => {
    const a = await signIn(app, newUser());
    await a.post('/v1/agents').send({ name: 'X', walletAddress: wallet() });
    chain.state.fail = true;
    const list = await a.get('/v1/agents');
    chain.state.fail = false;
    expect(list.body.agents[0].usdcBalance).toBe('unavailable');
  });

  it.each([
    ['bad address', { walletAddress: '0x1234' }],
    ['zero address', { walletAddress: '0x0000000000000000000000000000000000000000' }],
    ['protocol contract', { walletAddress: STOCKS.NVDAc.address }],
    ['floor >= target', { floorUsdc: '3000000', targetUsdc: '3000000' }],
    ['float money', { floorUsdc: '1.5' }],
    ['number money', { floorUsdc: 1000000 }],
    ['negative money', { floorUsdc: '-1' }],
    ['over hard cap', { maxPerRefillUsdc: '25000001' }],
    ['daily below per-refill', { maxPerRefillUsdc: '2000000', dailyLimitUsdc: '1000000' }],
    ['empty name', { name: '  ' }],
  ])('rejects %s', async (_n, patch) => {
    const a = await signIn(app, newUser());
    const res = await a.post('/v1/agents').send({ name: 'Scout', walletAddress: wallet(), ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_input');
  });

  it("rejects the user's own account as agent wallet, and duplicates", async () => {
    const me = newUser();
    const a = await signIn(app, me);
    expect((await a.post('/v1/agents').send({ name: 'S', walletAddress: me.address })).status).toBe(400);
    const w = wallet();
    expect((await a.post('/v1/agents').send({ name: 'S', walletAddress: w })).status).toBe(201);
    expect((await a.post('/v1/agents').send({ name: 'S2', walletAddress: w })).status).toBe(400);
  });

  it('edits limits and pauses; the wallet (destination, INV-5) can never change', async () => {
    const a = await signIn(app, newUser());
    const { body } = await a.post('/v1/agents').send({ name: 'Scout', walletAddress: wallet() });
    const id = body.agent.id;
    const p = await a.patch(`/v1/agents/${id}`).send({ status: 'paused', targetUsdc: '4000000' });
    expect(p.body.agent).toMatchObject({ status: 'paused', targetUsdc: '4000000' });
    const w = await a.patch(`/v1/agents/${id}`).send({ walletAddress: wallet() });
    expect(w.status).toBe(400);
    expect((await a.patch(`/v1/agents/${id}`).send({ userId: 'x' })).status).toBe(400);
    expect((await a.patch(`/v1/agents/${id}`).send({ status: 'deleted' })).status).toBe(400);
    expect((await a.patch(`/v1/agents/${id}`).send({ floorUsdc: '4000000' })).status).toBe(400); // floor >= target
  });

  it("user A can't see or touch user B's agent", async () => {
    const a = await signIn(app, newUser());
    const b = await signIn(app, newUser());
    const { body } = await a.post('/v1/agents').send({ name: 'Scout', walletAddress: wallet() });
    const id = body.agent.id;
    expect((await b.get(`/v1/agents/${id}`)).status).toBe(404);
    expect((await b.patch(`/v1/agents/${id}`).send({ status: 'paused' })).status).toBe(404);
    expect((await b.get('/v1/agents')).body.agents).toHaveLength(0);
    expect((await a.get(`/v1/agents/${id}`)).body.agent.status).toBe('active');
    expect((await b.get('/v1/agents/not-an-id')).status).toBe(404);
  });
});
