// Live read on Base mainnet (needs BASE_RPC_URL + network). Reads only; nothing is sent, nothing is paid.
import { describe, it, expect } from 'vitest';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { fairPriceCheck } from '../x402/fair-price/check.js';

describe('fair-price check on real Base state', () => {
  it('returns a real verdict for $1 of NVDAc', async () => {
    const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) });
    const { status, body } = await fairPriceCheck(client, { stock: 'NVDAc', usdc: '1' });
    console.log('[live] fair-price', JSON.stringify({ status, verdict: body.verdict, reason: body.reason, gapBps: body.gapBps, ref: body.reference?.usd, ageSec: body.reference?.ageSec, pool: body.pool, sell: body.sell }));
    expect(status).toBe(200);
    expect(['sell', 'wait']).toContain(body.verdict);
    expect(body.pool.address).toBe('0x853F5f1B92b16714Fe6CDA67CAad0856B83C7ab9');
  }, 60_000);
});
