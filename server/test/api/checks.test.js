import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startDb, fakeChain, config } from './helpers.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';

const SECRET = 'test-check-secret';
const PAYOUT = '0x2222222222222222222222222222222222222222';
const URL = `https://x402.bankr.bot/${PAYOUT}/fair-price`;
const rec = (o = {}) => ({
  checkId: '6f1c2a4e-9b7d-4c1e-8f3a-2d5b6c7e8f90',
  payer: '0x1111111111111111111111111111111111111111',
  stock: 'NVDAc',
  forUsdc: '1',
  verdict: 'wait',
  reason: 'price_stale',
  gapBps: null,
  refUsd: '142.03886724',
  ageSec: 172800,
  block: 38000000,
  checkedAt: '2026-11-25T16:00:00.000Z',
  ...o,
});

let env;
let app;
beforeAll(async () => {
  env = await startDb();
  app = createApp({ db: env.db, config: { ...config, checkSecret: SECRET, fairPriceUrl: URL }, chain: fakeChain() });
});
afterAll(() => env?.stop());

describe('POST /internal/checks (FR-FPC-001)', () => {
  it('refuses a missing or wrong secret', async () => {
    expect((await request(app).post('/internal/checks').send(rec())).status).toBe(401);
    expect((await request(app).post('/internal/checks').set('x-check-secret', 'nope').send(rec())).status).toBe(401);
  });

  it('refuses when no secret is configured, even with an empty header', async () => {
    const open = createApp({ db: env.db, config: { ...config, checkSecret: '' }, chain: fakeChain() });
    expect((await request(open).post('/internal/checks').set('x-check-secret', '').send(rec())).status).toBe(401);
  });

  it('refuses malformed records', async () => {
    for (const bad of [rec({ verdict: 'buy' }), rec({ stock: 'TSLAc' }), rec({ payer: 'x' }), rec({ verdict: 'sell', reason: 'price_stale' }), rec({ reason: 'whatever' }), rec({ checkId: '1' }), rec({ block: -1 }), rec({ forUsdc: '1e9' }), rec({ checkedAt: 'no' })]) {
      const r = await request(app).post('/internal/checks').set('x-check-secret', SECRET).send(bad);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('invalid_input');
    }
  });

  it('stores a check once (a retry with the same id is a no-op) and /proof shows it', async () => {
    for (let i = 0; i < 2; i++) expect((await request(app).post('/internal/checks').set('x-check-secret', SECRET).send(rec())).status).toBe(201);
    await request(app).post('/internal/checks').set('x-check-secret', SECRET).send(rec({ checkId: '7f1c2a4e-9b7d-4c1e-8f3a-2d5b6c7e8f91', verdict: 'sell', reason: null, gapBps: 10, ageSec: 1215 }));
    const p = await request(app).get('/v1/proof');
    expect(p.body.fairPrice).toEqual({ url: URL, payoutWallet: PAYOUT, priceUsdc: '0.01', answered: 2 });
    expect(p.body.checks).toHaveLength(2);
    expect(p.body.checks[0]).toMatchObject({ verdict: 'sell', gapBps: 10 });
    expect(p.body.checks[1]).toMatchObject({ verdict: 'wait', reason: 'price_stale', payer: rec().payer });
    expect(p.body.checks[0].checkId).toBeUndefined();
  });

  it('FAIR_PRICE_URL must be a Bankr x402 URL, else it is ignored', () => {
    expect(loadConfig({ FAIR_PRICE_URL: URL }).fairPriceUrl).toBe(URL);
    expect(loadConfig({ FAIR_PRICE_URL: 'https://evil.example/0x2222222222222222222222222222222222222222/fair-price' }).fairPriceUrl).toBe('');
  });
});
