import { describe, it, expect, vi } from 'vitest';
import { fairPriceCheck, parseInput, checkRecord, sendRecord } from '../x402/fair-price/check.js';
import { fakeClient, NOW } from './fakeChain.js';

describe('fair-price check (FR-FPC-001)', () => {
  it('fair price → sell, with stock amount and a min-out under the quote', async () => {
    const { status, body } = await fairPriceCheck(fakeClient({ gapBps: 30n }), { stock: 'NVDAc', usdc: '1.00' });
    expect(status).toBe(200);
    expect(body.verdict).toBe('sell');
    expect(body.reason).toBeNull();
    expect(body.gapBps).toBeLessThanOrEqual(31);
    expect(Number(body.sell.minUsdcOut)).toBeGreaterThan(0.98);
    expect(Number(body.sell.minUsdcOut)).toBeLessThanOrEqual(Number(body.pool.usdcOut));
    expect(body.reference.usd).toBe('153.54255219');
    expect(body.reference.ageSec).toBe(600);
    expect(body.notice).toMatch(/not financial advice/);
  });

  it('stale reference (market closed) → wait price_stale, still 200 (a correct paid answer)', async () => {
    const { status, body } = await fairPriceCheck(fakeClient({ updatedAt: NOW - 2n * 86_400n }), { usdc: '1' });
    expect(status).toBe(200);
    expect(body.verdict).toBe('wait');
    expect(body.reason).toBe('price_stale');
    expect(body.sell).toBeUndefined();
  });

  it('pool too far from the reference → wait price_gap_too_wide (both directions)', async () => {
    for (const below of [true, false]) {
      const { body } = await fairPriceCheck(fakeClient({ gapBps: 150n, below }), { usdc: '5' });
      expect(body.verdict).toBe('wait');
      expect(body.reason).toBe('price_gap_too_wide');
      expect(body.gapBps).toBeGreaterThan(100);
    }
  });

  it('incomplete round, zero price or zero quote → wait (fail closed)', async () => {
    expect((await fairPriceCheck(fakeClient({ roundId: 11n, answeredInRound: 10n }), { usdc: '1' })).body.verdict).toBe('wait');
    expect((await fairPriceCheck(fakeClient({ ref: 0n }), { usdc: '1' })).body.verdict).toBe('wait');
    expect((await fairPriceCheck(fakeClient({ quoteZero: true }), { usdc: '1' })).body.verdict).toBe('wait');
  });

  it('chain read or quote failure → 503 (not charged), never a verdict', async () => {
    expect((await fairPriceCheck(fakeClient({ failRead: true }), { usdc: '1' })).status).toBe(503);
    expect((await fairPriceCheck(fakeClient({ failQuote: true }), { usdc: '1' })).status).toBe(503);
  });

  it('bad input → 400 (not charged), before any chain read', async () => {
    const c = fakeClient();
    for (const input of [{}, { usdc: 'abc' }, { usdc: '0.05' }, { usdc: '1000.01' }, { usdc: '1.1234567' }, { usdc: '-1' }, { stock: 'TSLAc', usdc: '1' }, { stock: '__proto__', usdc: '1' }]) {
      expect((await fairPriceCheck(c, input)).status).toBe(400);
    }
    expect(c.calls).toEqual([]);
  });

  it('parses limits exactly', () => {
    expect(parseInput({ usdc: '0.10' }).usdcUnits).toBe(100_000n);
    expect(parseInput({ usdc: '1000' }).usdcUnits).toBe(1_000_000_000n);
  });

  it('record keeps public facts only and drops a malformed payer', async () => {
    const { body } = await fairPriceCheck(fakeClient(), { usdc: '1' });
    const r = checkRecord({ checkId: 'c1', payer: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD', body });
    expect(r).toMatchObject({ checkId: 'c1', payer: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', stock: 'NVDAc', forUsdc: '1', verdict: 'sell' });
    expect(checkRecord({ checkId: 'c2', payer: 'nope', body }).payer).toBeNull();
  });

  it('a failed record never throws (the paid answer still goes out)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sendRecord({ fetchFn: async () => { throw new Error('down'); }, url: 'https://x', secret: 's', record: {} })).toEqual({ sent: false, why: 'network' });
    expect(await sendRecord({ fetchFn: async () => ({ ok: false, status: 401 }), url: 'https://x', secret: 's', record: {} })).toEqual({ sent: false, why: 'status 401' });
    expect(await sendRecord({ url: '', secret: 's', record: {} })).toEqual({ sent: false, why: 'not configured' });
    spy.mockRestore();
  });
});
