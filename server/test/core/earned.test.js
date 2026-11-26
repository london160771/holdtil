import { describe, it, expect } from 'vitest';
import { earnedWhileWaiting, usdcValue } from '../../src/core/earned.js';

const D = { tokenDecimals: 8, priceDecimals: 8 };

describe('earned while waiting (display only)', () => {
  it('values stock in USDC base units with bigint math', () => {
    // 0.01 NVDAc at $150.00 = $1.50
    expect(usdcValue(1_000_000n, 15_000_000_000n, 8, 8)).toBe(1_500_000n);
  });

  it('price up → positive, counting stock held and USDC already paid out', () => {
    const e = earnedWhileWaiting({ heldStock: 1_000_000n, soldStock: 1_000_000n, usdcFromSales: 1_550_000n, startPrice: 15_000_000_000n, nowPrice: 16_500_000_000n, ...D });
    expect(e.idleUsdc).toBe(3_000_000n); // 0.02 × $150
    expect(e.keptUsdc).toBe(1_650_000n + 1_550_000n);
    expect(e.earnedUsdc).toBe(200_000n);
    expect(e.earnedBps).toBe(666n);
  });

  it('price down → negative (stocks can go down)', () => {
    const e = earnedWhileWaiting({ heldStock: 1_000_000n, soldStock: 0n, usdcFromSales: 0n, startPrice: 15_000_000_000n, nowPrice: 13_500_000_000n, ...D });
    expect(e.earnedUsdc).toBe(-150_000n);
    expect(e.earnedBps).toBe(-1000n);
  });

  it('refuses zero prices and floats', () => {
    expect(() => earnedWhileWaiting({ heldStock: 1n, soldStock: 0n, usdcFromSales: 0n, startPrice: 0n, nowPrice: 1n, ...D })).toThrow(RangeError);
    expect(() => usdcValue(1.5, 1n, 8, 8)).toThrow(TypeError);
  });
});
