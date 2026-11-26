import { describe, it, expect } from 'vitest';
import { marketStatus, publicMarketStatus, tradingDayOf } from '../../src/core/marketHours.js';

const at = (s) => new Date(s);

describe('market hours (display only)', () => {
  it('is open on a normal weekday afternoon', () => {
    const s = marketStatus(at('2026-11-24T15:00:00Z')); // Tue 10:00 ET
    expect(s.open).toBe(true);
    expect(s.nextCloseAt.toISOString()).toBe('2026-11-26T01:00:00.000Z'); // sessions run on; first close is Wed 20:00 ET (Thanksgiving eve)
  });

  it('treats the evening after 20:00 ET as the next trading day', () => {
    expect(tradingDayOf(at('2026-11-25T01:30:00Z')).date).toBe('2026-11-25'); // Tue 20:30 ET
    expect(tradingDayOf(at('2026-11-25T00:30:00Z')).date).toBe('2026-11-24'); // Tue 19:30 ET
  });

  it('is closed on Thanksgiving and reopens at 20:00 ET that evening', () => {
    const s = marketStatus(at('2026-11-26T12:30:00Z'));
    expect(s).toMatchObject({ open: false, reason: 'holiday', holiday: 'Thanksgiving' });
    expect(s.nextOpenAt.toISOString()).toBe('2026-11-27T01:00:00.000Z'); // Thu 20:00 EST
  });

  it('closes on Wednesday 20:00 ET before Thanksgiving', () => {
    expect(marketStatus(at('2026-11-26T00:59:00Z')).open).toBe(true);
    expect(marketStatus(at('2026-11-26T01:00:00Z')).open).toBe(false);
    expect(marketStatus(at('2026-11-25T20:00:00Z')).nextCloseAt.toISOString()).toBe('2026-11-26T01:00:00.000Z');
  });

  it('is closed on the weekend and reopens Sunday 20:00 ET', () => {
    const s = marketStatus(at('2026-11-28T15:00:00Z')); // Sat
    expect(s).toMatchObject({ open: false, reason: 'weekend', holiday: null });
    expect(s.nextOpenAt.toISOString()).toBe('2026-11-30T01:00:00.000Z'); // Sun 20:00 EST
    expect(marketStatus(at('2026-11-21T00:00:00Z')).open).toBe(true); // Fri 19:00 ET, still Friday's session
    expect(marketStatus(at('2026-11-21T01:00:00Z')).open).toBe(false); // Fri 20:00 ET
  });

  it('follows daylight saving time (summer = UTC-4)', () => {
    const s = marketStatus(at('2026-07-04T12:00:00Z')); // Sat after the Fri 3 Jul holiday
    expect(s.reason).toBe('weekend');
    expect(s.nextOpenAt.toISOString()).toBe('2026-07-06T00:00:00.000Z'); // Sun 20:00 EDT
  });

  it('skips a holiday Monday when finding the next open', () => {
    const s = marketStatus(at('2027-01-16T12:00:00Z')); // Sat before MLK day
    expect(s.nextOpenAt.toISOString()).toBe('2027-01-19T01:00:00.000Z'); // Mon 20:00 EST (Tuesday session)
  });

  it('returns ISO strings for the API and refuses a bad date', () => {
    const p = publicMarketStatus(at('2026-11-26T12:30:00Z'));
    expect(p).toMatchObject({ open: false, holiday: 'Thanksgiving', nextOpenAt: '2026-11-27T01:00:00.000Z', nextCloseAt: null });
    expect(() => marketStatus(new Date('nope'))).toThrow(TypeError);
  });
});
