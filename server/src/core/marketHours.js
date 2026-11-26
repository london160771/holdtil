// US stock market hours for the Coinbase stock price feeds (PRD §16 "Market hours"). DISPLAY ONLY.
// This never allows a sale: the price guard (INV-2) still decides from the feed's own updatedAt.
// It only explains why Holdtil waits (price_stale) and when the next refill window is expected.
//
// The Chainlink "Coinbase <TICKER>" feeds are 24/5: a session runs from 20:00 New York time on the evening
// before a trading day to 20:00 on that day. No session on weekends or NYSE full-day holidays.
// Seen on chain 2026-11-19..26 (NVDA feed): last update Fri 20 Nov 18:42 ET, next Sun 22 Nov 20:00 ET;
// last update Wed 25 Nov 19:17 ET, then silent on Thanksgiving.

// NYSE full-day closures. Source: https://www.nyse.com/markets/hours-calendars (checked 2026-11-26).
export const HOLIDAYS = Object.freeze({
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'Martin Luther King Jr. Day',
  '2026-02-16': "Washington's Birthday",
  '2026-04-03': 'Good Friday',
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth',
  '2026-07-03': 'Independence Day (observed)',
  '2026-09-07': 'Labor Day',
  '2026-11-26': 'Thanksgiving',
  '2026-12-25': 'Christmas',
  '2027-01-01': "New Year's Day",
  '2027-01-18': 'Martin Luther King Jr. Day',
  '2027-02-15': "Washington's Birthday",
  '2027-03-26': 'Good Friday',
  '2027-05-31': 'Memorial Day',
  '2027-06-18': 'Juneteenth (observed)',
  '2027-07-05': 'Independence Day (observed)',
  '2027-09-06': 'Labor Day',
  '2027-11-25': 'Thanksgiving',
  '2027-12-24': 'Christmas (observed)',
});

export const SESSION_START_HOUR_ET = 20;
const TZ = 'America/New_York';
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function nyParts(date) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hour: Number(p.hour) };
}

/** The trading day a moment belongs to: after 20:00 New York time, it is the next calendar day's session. */
export function tradingDayOf(date) {
  const { y, m, d, hour } = nyParts(date);
  const day = new Date(Date.UTC(y, m - 1, d + (hour >= SESSION_START_HOUR_ET ? 1 : 0)));
  return { date: day.toISOString().slice(0, 10), weekday: day.getUTCDay() };
}

function statusAt(date) {
  const t = tradingDayOf(date);
  if (t.weekday === 0 || t.weekday === 6) return { open: false, reason: 'weekend', holiday: null };
  if (HOLIDAYS[t.date]) return { open: false, reason: 'holiday', holiday: HOLIDAYS[t.date] };
  return { open: true, reason: null, holiday: null };
}

const STEP_MS = 15 * 60_000; // sessions start and end on the hour, so 15-minute steps land on the exact edge
const MAX_STEPS = (10 * 24 * 60) / 15; // look 10 days ahead at most

function nextChange(now, wantOpen) {
  let t = Math.ceil(now.getTime() / STEP_MS) * STEP_MS;
  if (t === now.getTime()) t += STEP_MS;
  for (let i = 0; i < MAX_STEPS; i += 1, t += STEP_MS) {
    if (statusAt(new Date(t)).open === wantOpen) return new Date(t);
  }
  return null;
}

/**
 * Market status at `now`. Display only.
 * @returns {{open:boolean, reason:'weekend'|'holiday'|null, holiday:string|null, nextOpenAt:Date|null, nextCloseAt:Date|null, calendarUntil:string}}
 */
export function marketStatus(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError('now must be a valid Date');
  const s = statusAt(now);
  return {
    ...s,
    nextOpenAt: s.open ? null : nextChange(now, true),
    nextCloseAt: s.open ? nextChange(now, false) : null,
    calendarUntil: Object.keys(HOLIDAYS).at(-1),
  };
}

/** JSON-friendly version for the API. */
export function publicMarketStatus(now = new Date()) {
  const s = marketStatus(now);
  return {
    open: s.open,
    reason: s.reason,
    holiday: s.holiday,
    nextOpenAt: s.nextOpenAt?.toISOString() ?? null,
    nextCloseAt: s.nextCloseAt?.toISOString() ?? null,
    sessionHoursEt: `${SESSION_START_HOUR_ET}:00 the evening before to ${SESSION_START_HOUR_ET}:00, Mon–Fri`,
    calendarUntil: s.calendarUntil,
  };
}
