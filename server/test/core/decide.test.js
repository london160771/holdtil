import { describe, it, expect } from 'vitest';
import { checkControls, checkSale } from '../../src/core/decide.js';

const controls = { globalPause: false, userStopped: false, agentPaused: false, permissionStatus: 'active' };
const price = { refPrice: 100n, refUpdatedAt: 10n, now: 20n, quotePrice: 100n, maxPriceAgeSec: 60n, maxGapBps: 100n };
const limits = { refillUsdc: 1n, maxPerRefillUsdc: 1n, agentSpentTodayUsdc: 0n, agentDailyLimitUsdc: 1n, userSpentTodayUsdc: 0n, userDailyLimitUsdc: 1n, stockAmount: 1n, allowanceRemaining: 1n };

describe('controls (INV-7) and check order', () => {
  it('all clear → ok', () => expect(checkControls(controls)).toEqual({ decision: 'ok' }));

  it.each([
    ['globalPause', true, 'paused'],
    ['userStopped', true, 'paused'],
    ['agentPaused', true, 'paused'],
    ['permissionStatus', 'revoked', 'permission_revoked'],
    ['permissionStatus', 'expired', 'permission_revoked'],
  ])('%s=%s stops with %s', (k, v, code) => {
    expect(checkControls({ ...controls, [k]: v })).toMatchObject({ decision: 'stop', code });
  });

  it('unknown control state fails closed', () => {
    expect(checkControls({ ...controls, globalPause: undefined })).toMatchObject({ decision: 'stop', code: 'paused' });
    expect(checkControls({ ...controls, permissionStatus: undefined })).toMatchObject({ decision: 'stop', code: 'permission_revoked' });
  });

  it('price is checked before limits', () => {
    const r = checkSale({ price: { ...price, now: 1000n }, limits: { ...limits, refillUsdc: 5n } });
    expect(r).toMatchObject({ decision: 'stop', code: 'price_stale' });
  });

  it('limits checked after a fair price', () => {
    expect(checkSale({ price, limits: { ...limits, refillUsdc: 5n } })).toMatchObject({ decision: 'stop', code: 'limit_exceeded' });
    expect(checkSale({ price, limits })).toEqual({ decision: 'ok', gapBps: 0n, ageSec: 10n });
  });
});
