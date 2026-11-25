// Limits (PRD §11 INV-3, FR-RFL-003). Pure. All amounts bigint base units.
import { assertUnits } from './money.js';

const IN_FLIGHT = new Set(['planned', 'checked', 'simulated', 'sent']);

/** UTC day key, e.g. "2026-11-24". Days roll over at 00:00 UTC. */
export function utcDayKey(nowSec) {
  return new Date(Number(nowSec) * 1000).toISOString().slice(0, 10);
}

/** createdAt as unix seconds (bigint). Accepts a bigint or a Date (how the DB stores it). Throws on anything else. */
export function toUnixSec(createdAt) {
  if (typeof createdAt === 'bigint') return createdAt;
  if (createdAt instanceof Date && !Number.isNaN(createdAt.getTime())) return BigInt(Math.floor(createdAt.getTime() / 1000));
  throw new TypeError('createdAt must be a bigint (unix seconds) or a Date');
}

/** Money from a refill: bigint, or a decimal string as stored in MongoDB (INV-1). Throws on anything else. */
export function toUnits(v, name) {
  if (typeof v === 'bigint' && v >= 0n) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v);
  throw new TypeError(`${name} must be a non-negative bigint or digit string`);
}

/**
 * USDC counted against today's limits: confirmed refills (actual usdcOut) plus in-flight
 * refills (planned amount, to be safe). Waited, blocked and failed refills count zero.
 * Works on DB documents directly. Unknown shapes throw (never skipped), so a bad record blocks the sale.
 * refills: [{ state, createdAt (Date | unix sec bigint), plannedUsdc, usdcOut? }]
 */
export function spentToday(refills, nowSec) {
  const today = utcDayKey(nowSec);
  let total = 0n;
  for (const r of refills) {
    if (utcDayKey(toUnixSec(r.createdAt)) !== today) continue;
    if (r.state === 'confirmed') total += toUnits(r.usdcOut ?? r.plannedUsdc, 'usdcOut');
    else if (IN_FLIGHT.has(r.state)) {
      // The larger of the lock-time plan and the re-checked max payout (Checkpoint C #8).
      const planned = toUnits(r.plannedUsdc, 'plannedUsdc');
      const payout = r.maxPayoutUsdc !== undefined && r.maxPayoutUsdc !== null ? toUnits(r.maxPayoutUsdc, 'maxPayoutUsdc') : 0n;
      total += payout > planned ? payout : planned;
    }
  }
  return total;
}

/**
 * INV-3. Checked before simulation.
 * @returns {{ok:true} | {ok:false, code:'limit_exceeded'|'allowance_exhausted', reason:string}}
 */
export function checkLimits({
  refillUsdc,
  maxPerRefillUsdc,
  agentSpentTodayUsdc,
  agentDailyLimitUsdc,
  userSpentTodayUsdc,
  userDailyLimitUsdc,
  stockAmount,
  allowanceRemaining,
}) {
  const vals = { refillUsdc, maxPerRefillUsdc, agentSpentTodayUsdc, agentDailyLimitUsdc, userSpentTodayUsdc, userDailyLimitUsdc, stockAmount, allowanceRemaining };
  for (const [k, v] of Object.entries(vals)) {
    try {
      assertUnits(v, k);
    } catch {
      return { ok: false, code: 'limit_exceeded', reason: `${k} unavailable` };
    }
  }
  if (refillUsdc === 0n) return { ok: false, code: 'limit_exceeded', reason: 'nothing to refill' };
  if (refillUsdc > maxPerRefillUsdc) return { ok: false, code: 'limit_exceeded', reason: 'over per-refill max' };
  if (agentSpentTodayUsdc + refillUsdc > agentDailyLimitUsdc) return { ok: false, code: 'limit_exceeded', reason: 'over agent daily limit' };
  if (userSpentTodayUsdc + refillUsdc > userDailyLimitUsdc) return { ok: false, code: 'limit_exceeded', reason: 'over user daily limit' };
  if (stockAmount === 0n || stockAmount > allowanceRemaining) return { ok: false, code: 'allowance_exhausted', reason: 'permission allowance left is too small' };
  return { ok: true };
}
