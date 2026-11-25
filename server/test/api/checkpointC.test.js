// Checkpoint C review fixes (PROJECT_STATE §10, 2026-11-25).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { startDb, makeApp, newUser, signIn, fakeChain, config } from './helpers.js';
import { createApp } from '../../src/app.js';
import { safeMessage } from '../../src/executor/tick.js';
import { spentToday } from '../../src/core/limits.js';
import { MAX_AGENTS_PER_USER } from '../../src/routes/agents.js';
import { REFILLS } from '../../src/db/refills.js';

let env;
let app;
beforeAll(async () => {
  env = await startDb();
  ({ app } = makeApp(env.db));
});
afterAll(async () => env.stop());
beforeEach(async () => {
  for (const c of ['agents', 'users', 'sessions', REFILLS]) await env.db.collection(c).deleteMany({});
});

describe('Checkpoint C fixes', () => {
  it('#3 safeMessage strips URLs (RPC keys) and keeps one short line', () => {
    const e = new Error('HTTP request failed.\n\nURL: https://api.developer.coinbase.com/rpc/v1/base/SECRETKEY123\nDetails: 429');
    e.shortMessage = 'HTTP request failed. URL: https://api.developer.coinbase.com/rpc/v1/base/SECRETKEY123';
    const m = safeMessage(e);
    expect(m).not.toMatch(/SECRETKEY123|coinbase\.com/);
    expect(m).toContain('[url]');
    expect(safeMessage('wss://x.y/abc?k=1 down')).toBe('[url] down');
  });

  it(`#4 at most ${MAX_AGENTS_PER_USER} agents per user`, async () => {
    const a = await signIn(app, newUser());
    for (let i = 0; i < MAX_AGENTS_PER_USER; i++) expect((await a.post('/v1/agents').send({ name: `B${i}`, walletAddress: newUser().address })).status).toBe(201);
    const res = await a.post('/v1/agents').send({ name: 'one more', walletAddress: newUser().address });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/at most/);
  });

  it('#5 shared auth cap holds even when every request claims a different IP', async () => {
    const capped = createApp({ db: env.db, config: { ...config, trustProxyHops: 2, rateLimits: { ...config.rateLimits, authGlobal: 3 } }, chain: fakeChain() });
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await request(capped).get('/v1/auth/nonce').set('X-Forwarded-For', `9.9.9.${i}, 76.76.21.21`)).status);
    expect(codes.slice(0, 3).every((c) => c !== 429)).toBe(true);
    expect(codes[4]).toBe(429);
  });

  it('#8 in-flight refills count the larger of planned and max payout', () => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const r = [{ state: 'checked', createdAt: new Date(), plannedUsdc: '1000000', maxPayoutUsdc: '1500000' }];
    expect(spentToday(r, now)).toBe(1_500_000n);
    expect(spentToday([{ ...r[0], maxPayoutUsdc: '500000' }], now)).toBe(1_000_000n);
  });

  it('#9 writes from another site are refused; the app origin and non-browser calls pass', async () => {
    const a = await signIn(app, newUser());
    expect((await a.post('/v1/me/stop').set('Origin', 'https://evil.example')).status).toBe(403);
    expect((await a.post('/v1/me/stop').set('Origin', config.appOrigin)).status).toBe(200);
    expect((await a.post('/v1/me/resume')).status).toBe(200);
  });
});
