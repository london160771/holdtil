import { describe, it, expect } from 'vitest';
import { missingEnv, loadConfig } from '../src/config/env.js';

describe('env', () => {
  it('reports missing names only', () => {
    expect(missingEnv(['A', 'B', 'C'], { A: 'x', B: '  ' })).toEqual(['B', 'C']);
  });

  it('live for all, $25 site cap and $0.02 gas fee by default; bad fee values stop the server', () => {
    const c = loadConfig({ LIVE_USER_ADDRESSES: '*' });
    expect(c).toMatchObject({ liveAll: true, liveUsers: [], liveMaxRefillUsdc: 25_000_000n, gasFeeUsdc: 20_000n, feeWallet: '' });
    expect(loadConfig({ LIVE_USER_ADDRESSES: '0x1111111111111111111111111111111111111111' }).liveAll).toBe(false);
    expect(loadConfig({ GAS_FEE_USDC: '0', FEE_WALLET: '0x3333333333333333333333333333333333333333' })).toMatchObject({ gasFeeUsdc: 0n, feeWallet: '0x3333333333333333333333333333333333333333' });
    expect(() => loadConfig({ GAS_FEE_USDC: '50001' })).toThrow(/GAS_FEE_USDC/);
    expect(() => loadConfig({ GAS_FEE_USDC: '0.02' })).toThrow(/GAS_FEE_USDC/);
    expect(() => loadConfig({ FEE_WALLET: 'me' })).toThrow(/FEE_WALLET/);
    expect(() => loadConfig({ FEE_WALLET: `0x${'0'.repeat(40)}` })).toThrow(/FEE_WALLET/);
    // A typo must never quietly raise the cap.
    for (const v of ['1,000,000', '$1', '1e6', '1.5']) expect(() => loadConfig({ LIVE_MAX_REFILL_USDC: v })).toThrow(/LIVE_MAX_REFILL_USDC/);
    expect(loadConfig({ LIVE_MAX_REFILL_USDC: ' 1000000 ' }).liveMaxRefillUsdc).toBe(1_000_000n);
  });
});
