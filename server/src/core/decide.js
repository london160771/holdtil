// The ordered checks before any sale (PRD §9 steps 4–7, §11). Pure.
// Order: controls (INV-7) → need → price (INV-2) → limits (INV-3). First failure wins.
import { checkPrice } from './priceGuard.js';
import { checkLimits } from './limits.js';

/**
 * controls: { globalPause, userStopped, agentPaused, permissionStatus: 'active'|'revoked'|'expired'|'unknown' }
 * @returns {{decision:'ok'} | {decision:'stop', code:string, reason:string}}
 */
export function checkControls({ globalPause, userStopped, agentPaused, permissionStatus }) {
  if (globalPause !== false) return { decision: 'stop', code: 'paused', reason: 'global pause' };
  if (userStopped !== false) return { decision: 'stop', code: 'paused', reason: 'owner pressed Stop' };
  if (agentPaused !== false) return { decision: 'stop', code: 'paused', reason: 'agent paused' };
  if (permissionStatus !== 'active') return { decision: 'stop', code: 'permission_revoked', reason: `permission ${permissionStatus ?? 'unknown'}` };
  return { decision: 'ok' };
}

/** Runs price then limits for an already-planned refill. Returns the first failure, or ok. */
export function checkSale({ price, limits }) {
  const p = checkPrice(price);
  if (!p.ok) return { decision: 'stop', ...p };
  const l = checkLimits(limits);
  if (!l.ok) return { decision: 'stop', ...l, gapBps: p.gapBps, ageSec: p.ageSec };
  return { decision: 'ok', gapBps: p.gapBps, ageSec: p.ageSec };
}
