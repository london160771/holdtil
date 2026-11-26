import { describe, it, expect } from 'vitest';
import { isAddress, getAddress } from 'viem';
import { ADDRESSES, POOLS, STOCKS, isAllowlisted, stockOf } from '../src/config/addresses.js';

describe('addresses.js (INV-6)', () => {
  const all = [...Object.entries(ADDRESSES), ...Object.entries(POOLS).map(([k, p]) => [k, p.address])];

  it.each(all)('%s is a checksummed address', (_name, addr) => {
    expect(isAddress(addr, { strict: true })).toBe(true);
    expect(getAddress(addr)).toBe(addr);
  });

  it('every stock points at allowlisted token, feed and pool', () => {
    for (const s of Object.values(STOCKS)) {
      expect(isAllowlisted(s.address)).toBe(true);
      expect(isAllowlisted(s.feed)).toBe(true);
      expect(isAllowlisted(s.pool.address)).toBe(true);
    }
  });

  it('each stock has its own token, feed and pool; agents default to NVDAc, unknown = null', () => {
    const vals = Object.values(STOCKS);
    for (const k of ['address', 'feed']) expect(new Set(vals.map((v) => v[k])).size).toBe(vals.length);
    expect(new Set(vals.map((v) => v.pool.address)).size).toBe(vals.length);
    for (const [sym, v] of Object.entries(STOCKS)) expect(v.symbol).toBe(sym);
    expect(stockOf({})).toBe(STOCKS.NVDAc);
    expect(stockOf({ stock: 'AAPLc' })).toBe(STOCKS.AAPLc);
    expect(stockOf({ stock: 'toString' })).toBeNull();
    expect(stockOf({ stock: 'XYZc' })).toBeNull();
  });

  it('rejects addresses not in the allowlist', () => {
    expect(isAllowlisted('0x0000000000000000000000000000000000000001')).toBe(false);
    expect(isAllowlisted(undefined)).toBe(false);
  });
});
