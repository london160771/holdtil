import { describe, it, expect } from 'vitest';
import { planRefillUsdc, stockAmountForUsdc, usdcValue, minOut, maxPayoutUsdc } from '../../src/core/refillPlanner.js';

const D = { tokenDecimals: 8, usdcDecimals: 6, priceDecimals: 8 };
const REF = 15_354_255_219n; // $153.54255219 (Gate 0 reading)

describe('refill planner', () => {
  it('no refill at or above floor', () => {
    expect(planRefillUsdc({ balanceUsdc: 2_000_000n, floorUsdc: 2_000_000n, targetUsdc: 5_000_000n, maxPerRefillUsdc: 10_000_000n })).toEqual({ needed: false });
  });

  it('below floor → refill up to target', () => {
    expect(planRefillUsdc({ balanceUsdc: 1_250_000n, floorUsdc: 2_000_000n, targetUsdc: 5_000_000n, maxPerRefillUsdc: 10_000_000n })).toEqual({ needed: true, usdc: 3_750_000n, capped: false });
  });

  it('caps at per-refill max', () => {
    expect(planRefillUsdc({ balanceUsdc: 0n, floorUsdc: 2_000_000n, targetUsdc: 5_000_000n, maxPerRefillUsdc: 1_000_000n })).toEqual({ needed: true, usdc: 1_000_000n, capped: true });
  });

  it('rejects floor >= target and non-bigint input', () => {
    expect(() => planRefillUsdc({ balanceUsdc: 0n, floorUsdc: 5n, targetUsdc: 5n, maxPerRefillUsdc: 1n })).toThrow();
    expect(() => planRefillUsdc({ balanceUsdc: 0, floorUsdc: 1n, targetUsdc: 5n, maxPerRefillUsdc: 1n })).toThrow();
  });

  it('stock amount covers the USDC at the reference price (rounded up) plus buffer', () => {
    const amt = stockAmountForUsdc({ usdc: 1_000_000n, refPrice: REF, ...D });
    expect(usdcValue({ stockAmount: amt, price: REF, ...D })).toBeGreaterThanOrEqual(1_000_000n);
    expect(usdcValue({ stockAmount: amt - 1n, price: REF, ...D })).toBeLessThan(1_000_000n);
    const withBuffer = stockAmountForUsdc({ usdc: 1_000_000n, refPrice: REF, ...D, bufferBps: 100n });
    expect(withBuffer).toBeGreaterThan(amt);
    expect(withBuffer).toBeLessThanOrEqual((amt * 10_100n) / 10_000n + 1n);
  });

  it('min-out never allows a fill worse than maxGap from the reference', () => {
    const stockAmount = 1_000_000n; // 0.01 NVDAc → ref value 1.535425 USDC
    const refValue = usdcValue({ stockAmount, price: REF, ...D });
    expect(refValue).toBe(1_535_425n);
    // quote is poor (pool moved): ref floor wins
    const m1 = minOut({ stockAmount, quotedOut: 1_400_000n, refPrice: REF, ...D, slippageBps: 50n, maxGapBps: 100n });
    expect(m1).toBe(1_520_071n);
    // quote is good: quote floor wins
    const m2 = minOut({ stockAmount, quotedOut: 1_540_000n, refPrice: REF, ...D, slippageBps: 10n, maxGapBps: 100n });
    expect(m2).toBe(1_538_460n);
  });

  it('min-out refuses bad inputs instead of returning a tiny floor', () => {
    const ok = { stockAmount: 1_000_000n, quotedOut: 1_500_000n, refPrice: REF, ...D, slippageBps: 50n, maxGapBps: 100n };
    expect(() => minOut({ ...ok, slippageBps: 10_000n })).toThrow();
    expect(() => minOut({ ...ok, maxGapBps: 10_000n })).toThrow();
    expect(() => minOut({ ...ok, maxGapBps: -1n })).toThrow();
    expect(() => minOut({ ...ok, quotedOut: -1n })).toThrow();
    expect(() => minOut({ ...ok, stockAmount: 0n })).toThrow();
    expect(() => minOut({ ...ok, refPrice: 0n })).toThrow();
    expect(() => minOut({ ...ok, slippageBps: 50 })).toThrow();
  });

  it('max payout is the higher of quote and reference + gap (used for limits)', () => {
    const args = { stockAmount: 1_000_000n, refPrice: REF, ...D, maxGapBps: 100n };
    expect(maxPayoutUsdc({ ...args, quotedOut: 1_500_000n })).toBe(1_550_780n); // ceil(1_535_425 * 1.01)
    expect(maxPayoutUsdc({ ...args, quotedOut: 1_600_000n })).toBe(1_600_000n);
  });
});
