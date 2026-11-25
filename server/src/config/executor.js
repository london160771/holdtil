// Executor settings (PRD §11 INV-2, §16). Bigints, basis points. Change only with a PRD §16 entry.
export const EXECUTOR = Object.freeze({
  maxPriceAgeSec: 3600n, // reference older than 1 h = stale = wait (24/5 feed; weekends always stale)
  maxFutureSkewSec: 30n, // reference up to 30 s newer than our block-time read counts as fresh (RPC node skew)
  maxGapBps: 100n, // quote must be within 1% of the reference
  slippageBps: 50n, // quote floor for min-out (the reference floor usually wins)
  bufferBps: 50n, // extra stock sold to cover the pool fee
  minRefillUsdc: 100_000n, // $0.10: smaller refills are not worth the gas; wait for the next permission period
  deadlineSec: 300n, // swap deadline after simulation
  confirmTimeoutSec: 60, // how long a tick waits for the user op; later ticks settle it
  repeatDecisionMs: 60 * 60_000, // same wait/block reason for the same agent is logged at most once an hour
});
