import { describe, it, expect } from 'vitest';
import { checkPrice, gapBps, quotePriceFromSwap } from '../../src/core/priceGuard.js';

const base = { refPrice: 15_000_000_000n, refUpdatedAt: 1_000n, now: 1_100n, quotePrice: 15_000_000_000n, maxPriceAgeSec: 600n, maxGapBps: 100n };

describe('priceGuard (INV-2)', () => {
  it('passes a fresh, fair price', () => {
    expect(checkPrice(base)).toEqual({ ok: true, gapBps: 0n, ageSec: 100n });
  });

  it('age exactly at the limit passes; one second over is stale', () => {
    expect(checkPrice({ ...base, now: 1_600n }).ok).toBe(true);
    expect(checkPrice({ ...base, now: 1_601n })).toMatchObject({ ok: false, code: 'price_stale' });
  });

  it('gap exactly at the limit passes; just over waits', () => {
    expect(checkPrice({ ...base, quotePrice: 15_150_000_000n })).toMatchObject({ ok: true, gapBps: 100n });
    expect(checkPrice({ ...base, quotePrice: 14_850_000_000n })).toMatchObject({ ok: true, gapBps: 100n });
    expect(checkPrice({ ...base, quotePrice: 15_150_000_001n })).toMatchObject({ ok: false, code: 'price_gap_too_wide', gapBps: 101n });
    expect(checkPrice({ ...base, quotePrice: 14_849_999_999n })).toMatchObject({ ok: false, code: 'price_gap_too_wide' });
  });

  it('earnings-night spike (~5%) waits', () => {
    const r = checkPrice({ ...base, quotePrice: 15_757_000_000n });
    expect(r).toMatchObject({ ok: false, code: 'price_gap_too_wide' });
  });

  it('fails closed on missing, zero, negative or future data', () => {
    expect(checkPrice({ ...base, refPrice: undefined })).toMatchObject({ ok: false, code: 'price_stale' });
    expect(checkPrice({ ...base, refPrice: 0n })).toMatchObject({ ok: false, code: 'price_stale' });
    expect(checkPrice({ ...base, refPrice: -1n })).toMatchObject({ ok: false, code: 'price_stale' });
    expect(checkPrice({ ...base, refUpdatedAt: 0n })).toMatchObject({ ok: false, code: 'price_stale' });
    expect(checkPrice({ ...base, refUpdatedAt: 2_000n })).toMatchObject({ ok: false, code: 'price_stale' });
    expect(checkPrice({ ...base, quotePrice: 0n })).toMatchObject({ ok: false, code: 'price_gap_too_wide' });
    expect(checkPrice({ ...base, quotePrice: 1.5 })).toMatchObject({ ok: false, code: 'price_stale' });
  });

  it('weekend: Friday close read on Sunday is stale', () => {
    const fri = 1_795_000_000n;
    expect(checkPrice({ ...base, refUpdatedAt: fri, now: fri + 2n * 86_400n })).toMatchObject({ ok: false, code: 'price_stale' });
  });

  it('gapBps rounds up', () => {
    expect(gapBps(10_001n, 10_000n)).toBe(1n);
    expect(gapBps(100_001n, 100_000n)).toBe(1n); // 0.1 bps → 1
    expect(() => gapBps(1n, 0n)).toThrow();
  });

  it('quotePriceFromSwap matches the Gate 0 numbers (0.01 NVDAc → 1.530096 USDC)', () => {
    const p = quotePriceFromSwap({ amountIn: 1_000_000n, amountOut: 1_530_096n, tokenDecimals: 8, usdcDecimals: 6, priceDecimals: 8 });
    expect(p).toBe(15_300_960_000n);
    expect(() => quotePriceFromSwap({ amountIn: 0n, amountOut: 1n, tokenDecimals: 8, usdcDecimals: 6, priceDecimals: 8 })).toThrow();
  });
});
