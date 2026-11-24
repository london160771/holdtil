// Limits (PRD §11 INV-3, FR-RFL-003). Pure. All amounts bigint base units.
import { assertUnits } from './money.js';

const IN_FLIGHT = new Set(['planned', 'checked', 'simulated', 'sent']);

/** UTC day key, e.g. "2026-11-24". Days roll over at 00:00 UTC. */
export function utcDayKey(nowSec) {
  return new Date(Number(nowSec) * 1000).toISOString().slice(0, 10);
}

/**
 * USDC counted against today's limits: confirmed refills (actual usdcOut) plus in-flight
 * refills (planned amount, to be safe). Waited, blocked and failed refills count zero.
 * refills: [{ state, createdAt (unix sec bigint), plannedUsdc (bigint), usdcOut (bigint|null) }]
 */
export function spentToday(refills, nowSec) {
  const today = utcDayKey(nowSec);
  let total = 0n;
  for (const r of refills) {
    if (utcDayKey(r.createdAt) !== today) continue;
    if (r.state === 'confirmed') total += r.usdcOut ?? r.plannedUsdc;
    else if (IN_FLIGHT.has(r.state)) total += r.plannedUsdc;
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
