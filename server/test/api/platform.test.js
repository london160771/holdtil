import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startDb, fakeChain, config } from './helpers.js';
import { createApp } from '../../src/app.js';
import { rateLimit } from '../../src/rateLimit.js';

let env;
beforeAll(async () => {
  env = await startDb();
});
afterAll(async () => env.stop());

describe('rate limits (PRD §12)', () => {
  it('auth endpoints answer 429 rate_limited after the limit, with Retry-After', async () => {
    const app = createApp({ db: env.db, config: { ...config, rateLimits: { auth: 3 } }, chain: fakeChain() });
    for (let i = 0; i < 3; i++) expect((await request(app).get('/v1/auth/nonce')).status).not.toBe(429);
    const res = await request(app).get('/v1/auth/nonce');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ code: 'rate_limited', retryable: true });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('write limit counts only writes; reads pass', async () => {
    const app = createApp({ db: env.db, config: { ...config, rateLimits: { write: 1 } }, chain: fakeChain() });
    for (let i = 0; i < 5; i++) expect((await request(app).get('/v1/proof')).status).not.toBe(429);
    expect((await request(app).post('/v1/agents').send({})).status).toBe(401);
    expect((await request(app).post('/v1/agents').send({})).status).toBe(429);
  });

  it('window resets after windowMs', () => {
    let t = 0;
    const mw = rateLimit({ windowMs: 1000, max: 1, now: () => t });
    const run = () => {
      let err;
      mw({ method: 'GET', ip: '1.1.1.1' }, { set() {} }, (e) => (err = e));
      return err;
    };
    expect(run()).toBeUndefined();
    expect(run()?.code).toBe('rate_limited');
    t = 1000;
    expect(run()).toBeUndefined();
  });
});

describe('proxy headers', () => {
  it('API answers are never cacheable', async () => {
    const app = createApp({ db: env.db, config, chain: fakeChain() });
    const res = await request(app).get('/v1/proof');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('behind Vercel + Render (2 hops) the limit is per client IP, not per proxy IP', async () => {
    const app = createApp({ db: env.db, config: { ...config, trustProxyHops: 2, rateLimits: { auth: 1 } }, chain: fakeChain() });
    const from = (ip) => request(app).get('/v1/auth/nonce').set('X-Forwarded-For', `${ip}, 76.76.21.21`);
    expect((await from('1.1.1.1')).status).not.toBe(429);
    expect((await from('2.2.2.2')).status).not.toBe(429);
    expect((await from('1.1.1.1')).status).toBe(429);
  });
});

describe('keep-alive', () => {
  it('/health pings MongoDB and says so', async () => {
    const app = createApp({ db: env.db, config, chain: fakeChain() });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
  });

  it('/health answers 503 when MongoDB is unreachable', async () => {
    const broken = { command: async () => { throw new Error('down'); }, collection: () => ({}) };
    const res = await request(createApp({ db: broken, config, chain: fakeChain() })).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', db: 'unavailable' });
  });
});
