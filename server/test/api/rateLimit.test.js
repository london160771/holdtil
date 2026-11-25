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
