// Default and hard limits in USDC base units (6 decimals). PRD §16 (2026-11-24), §33 Q4.
// Hard caps hold during rollout steps 4–5 (CLAUDE.md §6): small limits first. Raise only via the PRD.
export const USDC_DECIMALS = 6;
const usdc = (whole) => BigInt(whole) * 10n ** BigInt(USDC_DECIMALS);

export const DEFAULTS = Object.freeze({
  floorUsdc: usdc(1),
  targetUsdc: usdc(3),
  maxPerRefillUsdc: usdc(2),
  dailyLimitUsdc: usdc(5),
  userDailyLimitUsdc: usdc(10),
});

export const HARD_CAPS = Object.freeze({
  targetUsdc: usdc(50),
  maxPerRefillUsdc: usdc(25),
  dailyLimitUsdc: usdc(50),
  userDailyLimitUsdc: usdc(100),
});

// Spend permission period: 1 day (allowance resets daily). Max lifetime 1 year.
export const PERMISSION_RULES = Object.freeze({ minPeriodSec: 3_600, maxPeriodSec: 31 * 86_400, maxLifetimeSec: 366 * 86_400 });
