// Fair-price guard (PRD §11 INV-2, FR-RFL-002). Pure: plain data in, decision out. Fails closed.
import { assertUnits, ceilDiv, pow10 } from './money.js';

/**
 * Price per 1 whole token, in `priceDecimals`, implied by a swap quote. Rounded down.
 * amountIn is token base units, amountOut is USDC base units.
 */
export function quotePriceFromSwap({ amountIn, amountOut, tokenDecimals, usdcDecimals, priceDecimals }) {
  assertUnits(amountIn, 'amountIn');
  assertUnits(amountOut, 'amountOut');
  if (amountIn === 0n) throw new RangeError('amountIn must be > 0');
  return (amountOut * pow10(priceDecimals) * pow10(tokenDecimals)) / (amountIn * pow10(usdcDecimals));
}

/** |quote − ref| / ref in basis points, rounded UP so a boundary case never looks better than it is. */
export function gapBps(quotePrice, refPrice) {
  if (refPrice <= 0n) throw new RangeError('refPrice must be > 0');
  const diff = quotePrice > refPrice ? quotePrice - refPrice : refPrice - quotePrice;
  return ceilDiv(diff * 10_000n, refPrice);
}

/**
 * INV-2: sell only if the reference is fresh AND the quote is within maxGapBps of it.
 * All money/time inputs bigint; times are unix seconds. refDecimals and quoteDecimals (numbers) must
 * match, so both prices are in the same units. roundId/answeredInRound, if given, must show a complete round.
 * Unknown or odd data → no sale.
 * @returns {{ok:true, gapBps:bigint, ageSec:bigint} | {ok:false, code:string, reason:string, gapBps?:bigint, ageSec?:bigint}}
 */
export function checkPrice({ refPrice, refUpdatedAt, now, quotePrice, maxPriceAgeSec, maxGapBps, refDecimals, quoteDecimals, roundId, answeredInRound, maxFutureSkewSec = 0n }) {
  for (const [k, v] of Object.entries({ refPrice, refUpdatedAt, now, quotePrice, maxPriceAgeSec, maxGapBps })) {
    if (typeof v !== 'bigint') return { ok: false, code: 'price_stale', reason: `${k} unavailable` };
  }
  if (!Number.isInteger(refDecimals) || refDecimals !== quoteDecimals) {
    return { ok: false, code: 'price_stale', reason: 'reference and quote price units differ or are unknown' };
  }
  if (roundId !== undefined || answeredInRound !== undefined) {
    if (typeof roundId !== 'bigint' || typeof answeredInRound !== 'bigint' || answeredInRound < roundId) {
      return { ok: false, code: 'price_stale', reason: 'reference round incomplete' };
    }
  }
  if (refPrice <= 0n || refUpdatedAt <= 0n) return { ok: false, code: 'price_stale', reason: 'reference unavailable' };
  let ageSec = now - refUpdatedAt;
  // RPC reads can land on a slightly newer block than our clock read (load-balanced nodes, a new block in
  // between). A few seconds "in the future" is a brand-new price, not a bad one. Beyond the skew: refuse.
  if (ageSec < 0n) {
    if (typeof maxFutureSkewSec !== 'bigint' || -ageSec > maxFutureSkewSec) return { ok: false, code: 'price_stale', reason: 'reference time is in the future', ageSec };
    ageSec = 0n;
  }
  if (ageSec > maxPriceAgeSec) return { ok: false, code: 'price_stale', reason: `reference is ${ageSec}s old`, ageSec };
  if (quotePrice <= 0n) return { ok: false, code: 'price_gap_too_wide', reason: 'no usable quote', ageSec };
  const gap = gapBps(quotePrice, refPrice);
  if (gap > maxGapBps) return { ok: false, code: 'price_gap_too_wide', reason: `quote is ${gap} bps from reference`, gapBps: gap, ageSec };
  return { ok: true, gapBps: gap, ageSec };
}
