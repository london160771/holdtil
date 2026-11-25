// Structured error and decision codes (PRD §11). Every error has code, retryable, nextAction.

export const CODES = Object.freeze({
  price_stale: { retryable: true, nextAction: 'Wait for next tick' },
  price_gap_too_wide: { retryable: true, nextAction: 'Wait for next tick' },
  limit_exceeded: { retryable: false, nextAction: 'Owner raises limit or waits' },
  allowance_exhausted: { retryable: false, nextAction: 'Wait for new period or re-grant' },
  permission_revoked: { retryable: false, nextAction: 'Owner grants again' },
  paused: { retryable: false, nextAction: 'Owner resumes' },
  simulation_failed: { retryable: true, nextAction: 'Retry next tick; alert after 3' },
  tx_failed: { retryable: true, nextAction: 'Investigate; alert' },
  refill_in_flight: { retryable: true, nextAction: 'Skip this tick' },
  auth_failed: { retryable: false, nextAction: 'Sign in again' },
  refill_expired: { retryable: true, nextAction: 'Stuck in flight too long; next tick tries again' },
  illegal_transition: { retryable: false, nextAction: 'Bug: investigate the refill log' },
  invalid_input: { retryable: false, nextAction: 'Fix the input and try again' },
  not_found: { retryable: false, nextAction: 'Check the URL' },
  onboarding_required: { retryable: false, nextAction: 'Confirm you are not a US person and accept the terms' },
  permission_invalid: { retryable: false, nextAction: 'Sign the permission again from your Base Account' },
  chain_unavailable: { retryable: true, nextAction: 'Try again shortly' },
  dry_run: { retryable: true, nextAction: 'Dry run: checks and simulation passed, nothing was sent' },
  internal_error: { retryable: true, nextAction: 'Try again later' },
});

export class HoldtilError extends Error {
  constructor(code, message, { status = 400, details } = {}) {
    const meta = CODES[code];
    if (!meta) throw new Error(`Unknown error code: ${code}`);
    super(message || code);
    this.code = code;
    this.retryable = meta.retryable;
    this.nextAction = meta.nextAction;
    this.status = status;
    this.details = details;
  }

  toJSON() {
    return { code: this.code, message: this.message, retryable: this.retryable, nextAction: this.nextAction };
  }
}
