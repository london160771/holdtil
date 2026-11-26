import { describe, it, expect, vi } from 'vitest';
import { handle } from '../x402/fair-price/index.ts';
import { fakeClient } from './fakeChain.js';

const env = { HOLDTIL_CHECKS_URL: 'https://api.example/internal/checks', CHECK_SECRET: 'test-secret' };
const PAYER = '0x1111111111111111111111111111111111111111';

describe('Bankr handler', () => {
  it('GET → answer, and records it with the verified payer and the secret header', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 201 }));
    const res = await handle(new Request('https://x402.bankr.bot/0xw/fair-price?stock=NVDAc&usdc=2', { headers: { 'x-402-payer': PAYER } }), { client: fakeClient(), fetchFn, env });
    expect(res.status).toBe(200);
    expect((await res.json()).verdict).toBe('sell');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(env.HOLDTIL_CHECKS_URL);
    expect(init.headers['x-check-secret']).toBe('test-secret');
    expect(JSON.parse(init.body)).toMatchObject({ payer: PAYER, verdict: 'sell', forUsdc: '2' });
  });

  it('POST JSON body works', async () => {
    const res = await handle(new Request('https://x/fair-price', { method: 'POST', body: JSON.stringify({ usdc: '1.5' }) }), { client: fakeClient(), fetchFn: async () => new Response('{}'), env });
    expect((await res.json()).forUsdc).toBe('1.5');
  });

  it('bad JSON or bad input → 400, nothing recorded', async () => {
    const fetchFn = vi.fn();
    expect((await handle(new Request('https://x', { method: 'POST', body: '{' }), { client: fakeClient(), fetchFn, env })).status).toBe(400);
    expect((await handle(new Request('https://x?usdc=0'), { client: fakeClient(), fetchFn, env })).status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('no RPC configured → 503 (not charged)', async () => {
    expect((await handle(new Request('https://x?usdc=1'), { env: {} })).status).toBe(503);
  });

  it('record failure does not change the answer', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handle(new Request('https://x?usdc=1'), { client: fakeClient(), fetchFn: async () => { throw new Error('down'); }, env });
    expect(res.status).toBe(200);
    spy.mockRestore();
  });
});
