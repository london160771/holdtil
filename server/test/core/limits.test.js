import { describe, it, expect } from 'vitest';
import { checkLimits, spentToday, utcDayKey } from '../../src/core/limits.js';

const ok = {
  refillUsdc: 5_000_000n,
  maxPerRefillUsdc: 5_000_000n,
  agentSpentTodayUsdc: 0n,
  agentDailyLimitUsdc: 10_000_000n,
  userSpentTodayUsdc: 0n,
  userDailyLimitUsdc: 20_000_000n,
  stockAmount: 3_300_000n,
  allowanceRemaining: 3_300_000n,
};

describe('limits (INV-3)', () => {
  it('passes inside every limit (edges inclusive)', () => {
    expect(checkLimits(ok)).toEqual({ ok: true });
    expect(checkLimits({ ...ok, agentSpentTodayUsdc: 5_000_000n })).toEqual({ ok: true });
  });

  it.each([
    ['per-refill max', { refillUsdc: 5_000_001n }],
    ['agent daily limit', { agentSpentTodayUsdc: 5_000_001n }],
    ['user daily limit', { userSpentTodayUsdc: 15_000_001n }],
    ['zero refill', { refillUsdc: 0n }],
  ])('blocks: %s', (_n, patch) => {
    expect(checkLimits({ ...ok, ...patch })).toMatchObject({ ok: false, code: 'limit_exceeded' });
  });

  it('blocks when the on-chain allowance left is too small', () => {
    expect(checkLimits({ ...ok, allowanceRemaining: 3_299_999n })).toMatchObject({ ok: false, code: 'allowance_exhausted' });
    expect(checkLimits({ ...ok, stockAmount: 0n })).toMatchObject({ ok: false, code: 'allowance_exhausted' });
  });

  it('fails closed on missing or float values', () => {
    expect(checkLimits({ ...ok, userDailyLimitUsdc: undefined })).toMatchObject({ ok: false, code: 'limit_exceeded' });
    expect(checkLimits({ ...ok, refillUsdc: 5 })).toMatchObject({ ok: false, code: 'limit_exceeded' });
    expect(checkLimits({ ...ok, allowanceRemaining: -1n })).toMatchObject({ ok: false, code: 'limit_exceeded' });
  });

  it('spentToday reads DB documents (Date createdAt, string money)', () => {
    const now = BigInt(Date.UTC(2026, 10, 24, 12) / 1000);
    const docs = [
      { state: 'sent', createdAt: new Date(Date.UTC(2026, 10, 24, 1)), plannedUsdc: '5000000' },
      { state: 'confirmed', createdAt: new Date(Date.UTC(2026, 10, 24, 2)), plannedUsdc: '1000000', usdcOut: '990000' },
      { state: 'confirmed', createdAt: new Date(Date.UTC(2026, 10, 23, 2)), plannedUsdc: '1', usdcOut: '1' },
    ];
    expect(spentToday(docs, now)).toBe(5_990_000n);
  });

  it('spentToday throws on unknown shapes instead of skipping them', () => {
    const now = 1_795_000_000n;
    expect(() => spentToday([{ state: 'sent', createdAt: 'yesterday', plannedUsdc: 1n }], now)).toThrow();
    expect(() => spentToday([{ state: 'sent', createdAt: 1_795_000_000, plannedUsdc: 1n }], now)).toThrow();
    expect(() => spentToday([{ state: 'sent', createdAt: now, plannedUsdc: 1.5 }], now)).toThrow();
    expect(() => spentToday([{ state: 'sent', createdAt: now, plannedUsdc: '-5' }], now)).toThrow();
  });

  it('spentToday counts confirmed + in-flight from today only (UTC rollover)', () => {
    const now = BigInt(Date.UTC(2026, 10, 24, 12) / 1000);
    const yesterday = BigInt(Date.UTC(2026, 10, 23, 23, 59, 59) / 1000);
    const midnight = BigInt(Date.UTC(2026, 10, 24, 0) / 1000);
    const refills = [
      { state: 'confirmed', createdAt: midnight, plannedUsdc: 5n, usdcOut: 4n },
      { state: 'sent', createdAt: now, plannedUsdc: 10n, usdcOut: null },
      { state: 'planned', createdAt: now, plannedUsdc: 100n },
      { state: 'waited', createdAt: now, plannedUsdc: 1000n },
      { state: 'blocked', createdAt: now, plannedUsdc: 1000n },
      { state: 'failed', createdAt: now, plannedUsdc: 1000n },
      { state: 'confirmed', createdAt: yesterday, plannedUsdc: 1000n, usdcOut: 1000n },
    ];
    expect(spentToday(refills, now)).toBe(114n);
    expect(utcDayKey(midnight)).toBe('2026-11-24');
    expect(utcDayKey(yesterday)).toBe('2026-11-23');
  });
});
