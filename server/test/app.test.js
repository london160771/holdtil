import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('API basics', () => {
  it('GET /health returns ok on Base mainnet', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', network: 'base-mainnet', chainId: 8453 });
  });

  it('unknown route returns a structured error', async () => {
    const res = await request(createApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'not_found', retryable: false });
    expect(res.body.error.nextAction).toBeTypeOf('string');
  });
});
