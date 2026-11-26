// Refill planner (PRD §9 steps 5–7). Pure bigint math in base units.
import { assertUnits, ceilDiv, max, min, pow10 } from './money.js';

/**
 * How much USDC the agent needs. Below floor → refill up to target, capped at maxPerRefill
 * (a smaller refill that respects INV-3 beats a refill that is always blocked).
 * @returns {{needed:false} | {needed:true, usdc:bigint, capped:boolean}}
 */
export function planRefillUsdc({ balanceUsdc, floorUsdc, targetUsdc, maxPerRefillUsdc }) {
  assertUnits(balanceUsdc, 'balanceUsdc');
  assertUnits(floorUsdc, 'floorUsdc');
  assertUnits(targetUsdc, 'targetUsdc');
  assertUnits(maxPerRefillUsdc, 'maxPerRefillUsdc');
  if (floorUsdc >= targetUsdc) throw new RangeError('floor must be below target');
  if (balanceUsdc >= floorUsdc) return { needed: false };
  const gap = targetUsdc - balanceUsdc;
  const usdc = min(gap, maxPerRefillUsdc);
  return { needed: usdc > 0n, usdc, capped: usdc < gap };
}

/** USDC value (base units) of `stockAmount` at `price` (per whole token, priceDecimals). Rounded down. */
export function usdcValue({ stockAmount, price, tokenDecimals, usdcDecimals, priceDecimals }) {
  return (stockAmount * price * pow10(usdcDecimals)) / (pow10(tokenDecimals) * pow10(priceDecimals));
}

/**
 * Stock to sell for `usdc` at the reference price, plus a small buffer for fees. Rounded up.
 */
export function stockAmountForUsdc({ usdc, refPrice, tokenDecimals, usdcDecimals, priceDecimals, bufferBps = 0n }) {
  assertUnits(usdc, 'usdc');
  if (refPrice <= 0n) throw new RangeError('refPrice must be > 0');
  const base = ceilDiv(usdc * pow10(tokenDecimals) * pow10(priceDecimals), refPrice * pow10(usdcDecimals));
  return ceilDiv(base * (10_000n + bufferBps), 10_000n);
}

/**
 * Min-out for the swap. Two floors, the higher wins:
 *  - quote floor: quotedOut minus slippage
 *  - reference floor: the reference value minus maxGapBps — so even if the pool moves after the
 *    quote, the swap reverts on chain rather than fill outside the user's fair-price limit (INV-2).
 */
function assertBps(v, name) {
  if (typeof v !== 'bigint' || v < 0n || v >= 10_000n) throw new RangeError(`${name} must be a bigint in [0, 10000)`);
}

export function minOut({ stockAmount, quotedOut, refPrice, tokenDecimals, usdcDecimals, priceDecimals, slippageBps, maxGapBps }) {
  assertUnits(stockAmount, 'stockAmount');
  assertUnits(quotedOut, 'quotedOut');
  assertUnits(refPrice, 'refPrice');
  assertBps(slippageBps, 'slippageBps');
  assertBps(maxGapBps, 'maxGapBps');
  if (stockAmount === 0n || refPrice === 0n) throw new RangeError('stockAmount and refPrice must be > 0');
  const quoteFloor = (quotedOut * (10_000n - slippageBps)) / 10_000n;
  const refValue = usdcValue({ stockAmount, price: refPrice, tokenDecimals, usdcDecimals, priceDecimals });
  const refFloor = ceilDiv(refValue * (10_000n - maxGapBps), 10_000n);
  const out = max(quoteFloor, refFloor);
  if (out <= 0n) throw new RangeError('min-out must be > 0');
  return out;
}

/**
 * The most USDC this sale should pay out, for the limit check (INV-3): the higher of the quote and
 * the reference value plus maxGapBps. Limits are checked against this, not the planned USDC, so a
 * buffer or a favourable quote can't push today's spend past the limit. A fill above this needs the
 * pool to move past the fair-price band within the same block; that is a better price for the user
 * and the confirmed amount still counts toward the next check.
 */
export function maxPayoutUsdc({ stockAmount, quotedOut, refPrice, tokenDecimals, usdcDecimals, priceDecimals, maxGapBps }) {
  assertUnits(stockAmount, 'stockAmount');
  assertUnits(quotedOut, 'quotedOut');
  assertBps(maxGapBps, 'maxGapBps');
  const refValue = usdcValue({ stockAmount, price: refPrice, tokenDecimals, usdcDecimals, priceDecimals });
  const refCeil = ceilDiv(refValue * (10_000n + maxGapBps), 10_000n);
  return max(quotedOut, refCeil);
}
