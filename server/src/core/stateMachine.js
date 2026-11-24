// Refill state machine (PRD §11). Illegal transitions throw. Every transition is logged.
import { HoldtilError, CODES } from '../errors.js';

export const STATES = Object.freeze(['planned', 'checked', 'simulated', 'sent', 'confirmed', 'failed', 'waited', 'blocked']);
export const IN_FLIGHT_STATES = Object.freeze(['planned', 'checked', 'simulated', 'sent']);
export const TERMINAL_STATES = Object.freeze(['confirmed', 'failed', 'waited', 'blocked']);

const NEXT = Object.freeze({
  planned: ['checked', 'waited', 'blocked'],
  checked: ['simulated', 'waited', 'blocked'],
  simulated: ['sent'],
  sent: ['confirmed', 'failed'],
  confirmed: [],
  failed: [],
  waited: [],
  blocked: [],
});

export function canTransition(from, to) {
  return Boolean(NEXT[from]?.includes(to));
}

/** waited if the decision code is retryable, blocked if not (e.g. simulation_failed → waited, paused → blocked). */
export function decisionStateFor(code) {
  const meta = CODES[code];
  if (!meta) throw new HoldtilError('invalid_input', `unknown decision code ${code}`);
  return meta.retryable ? 'waited' : 'blocked';
}

/**
 * Returns a NEW refill object in state `to`, with the transition appended to `history`.
 * Throws illegal_transition for anything not in the table.
 */
export function transition(refill, to, { at, code = null, note = null } = {}) {
  const from = refill.state;
  if (!canTransition(from, to)) {
    throw new HoldtilError('illegal_transition', `refill ${refill.refillId ?? '?'}: ${from} → ${to} is not allowed`);
  }
  if ((to === 'waited' || to === 'blocked' || to === 'failed') && !code) {
    throw new HoldtilError('illegal_transition', `${to} needs a decision code`);
  }
  const entry = { from, to, at: at ?? new Date().toISOString(), code, note };
  return { ...refill, state: to, code: code ?? refill.code ?? null, history: [...(refill.history ?? []), entry] };
}
