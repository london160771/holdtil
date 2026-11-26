// Holdtil fair-price check (PRD FR-FPC-001), hosted on Bankr x402 Cloud. Read-only: it never trades,
// holds or moves funds. Same rule and math as Holdtil's refills (lib/ = exact copies of server/src/core).
// Bad input → 400, chain trouble → 503: Bankr only charges the caller on a status below 400.
import { formatUnits, parseUnits } from 'viem';
import { checkPrice, quotePriceFromSwap } from './lib/priceGuard.js';
import { stockAmountForUsdc, usdcValue, minOut as computeMinOut } from './lib/refillPlanner.js';
import { ceilDiv } from './lib/money.js';
import { AERO_CL_QUOTER, RULE, STOCKS, USDC, erc20DecimalsAbi, feedAbi, quoterAbi } from './constants.js';

export const MIN_USDC = 100_000n; // $0.10
export const MAX_USDC = 1_000_000_000n; // $1,000 (the pool holds ~$18k; bigger sales should not trust one quote)
const USDC_RE = /^\d{1,4}(\.\d{1,6})?$/;
const RULE_TEXT = 'Holdtil sells only if the Chainlink reference is at most 1 hour old and the pool quote is within 1% of it. Otherwise it waits.';
const NOTICE = 'Price facts, not financial advice. Stocks can go down. Not for US persons.';

const bad = (message) => ({ status: 400, body: { error: { code: 'invalid_input', message, retryable: false, nextAction: 'Fix the input and try again (not charged)' } } });
const unavailable = (message) => ({ status: 503, body: { error: { code: 'chain_unavailable', message, retryable: true, nextAction: 'Try again shortly (not charged)' } } });

/** Validates { stock, usdc } from the query or JSON body. */
export function parseInput(input) {
  const stockKey = String(input?.stock ?? 'NVDAc');
  const stock = Object.hasOwn(STOCKS, stockKey) ? STOCKS[stockKey] : null;
  if (!stock) return { error: bad(`stock must be one of: ${Object.keys(STOCKS).join(', ')}`) };
  const usdc = String(input?.usdc ?? '').trim();
  if (!USDC_RE.test(usdc)) return { error: bad('usdc must be a USD amount like "1.50" (max 6 decimals)') };
  const units = parseUnits(usdc, 6);
  if (units < MIN_USDC || units > MAX_USDC) return { error: bad('usdc must be between 0.10 and 1000') };
  return { stock, usdc, usdcUnits: units };
}

/**
 * Runs the check against Base mainnet through `client` (a viem public client).
 * @returns {Promise<{status:number, body:object}>}
 */
export async function fairPriceCheck(client, input) {
  const parsed = parseInput(input);
  if (parsed.error) return parsed.error;
  const { stock, usdc } = parsed;

  let tokenDecimals, usdcDecimals, priceDecimals, round, block;
  try {
    const [td, ud, fd, rd, b] = await Promise.all([
      client.readContract({ address: stock.address, abi: erc20DecimalsAbi, functionName: 'decimals' }),
      client.readContract({ address: USDC, abi: erc20DecimalsAbi, functionName: 'decimals' }),
      client.readContract({ address: stock.feed, abi: feedAbi, functionName: 'decimals' }),
      client.readContract({ address: stock.feed, abi: feedAbi, functionName: 'latestRoundData' }),
      client.getBlock(),
    ]);
    [tokenDecimals, usdcDecimals, priceDecimals, round, block] = [Number(td), Number(ud), Number(fd), rd, b];
  } catch {
    return unavailable('Could not read Base right now');
  }
  // USDC amount in the token's real decimals (read on chain, not assumed).
  const usdcUnits = parseUnits(usdc, usdcDecimals);
  const [roundId, refPrice, , refUpdatedAt, answeredInRound] = round;
  const now = block.timestamp;

  const base = {
    stock: { symbol: stock.symbol, address: stock.address, decimals: tokenDecimals },
    forUsdc: usdc,
    reference: {
      source: stock.feedName,
      feed: stock.feed,
      usd: refPrice > 0n ? formatUnits(refPrice, priceDecimals) : null,
      updatedAt: refUpdatedAt > 0n ? new Date(Number(refUpdatedAt) * 1000).toISOString() : null,
      ageSec: refUpdatedAt > 0n && now >= refUpdatedAt ? Number(now - refUpdatedAt) : null,
    },
    maxPriceAgeSec: Number(RULE.maxPriceAgeSec),
    maxGapBps: Number(RULE.maxGapBps),
    block: Number(block.number),
    checkedAt: new Date(Number(now) * 1000).toISOString(),
    rule: RULE_TEXT,
    notice: NOTICE,
  };
  const wait = (code, detail, extra = {}) => ({ status: 200, body: { verdict: 'wait', reason: code, detail, ...base, ...extra } });

  if (refPrice <= 0n || refUpdatedAt <= 0n) return wait('price_stale', 'reference unavailable');

  const stockAmount = stockAmountForUsdc({ usdc: usdcUnits, refPrice, tokenDecimals, usdcDecimals, priceDecimals, bufferBps: RULE.bufferBps });
  let quotedOut;
  try {
    const { result } = await client.simulateContract({
      address: AERO_CL_QUOTER,
      abi: quoterAbi,
      functionName: 'quoteExactInputSingle',
      args: [{ tokenIn: stock.address, tokenOut: USDC, amountIn: stockAmount, tickSpacing: stock.pool.tickSpacing, sqrtPriceLimitX96: 0n }],
    });
    quotedOut = result[0];
  } catch {
    return unavailable('Could not get a pool quote right now');
  }
  const quotePrice = quotedOut > 0n ? quotePriceFromSwap({ amountIn: stockAmount, amountOut: quotedOut, tokenDecimals, usdcDecimals, priceDecimals }) : 0n;
  const pool = {
    venue: stock.pool.venue,
    address: stock.pool.address,
    sells: formatUnits(stockAmount, tokenDecimals),
    usdcOut: formatUnits(quotedOut, usdcDecimals),
    pricePerToken: quotePrice > 0n ? formatUnits(quotePrice, priceDecimals) : null,
  };

  const price = checkPrice({
    refPrice,
    refUpdatedAt,
    now,
    quotePrice,
    maxPriceAgeSec: RULE.maxPriceAgeSec,
    maxGapBps: RULE.maxGapBps,
    refDecimals: priceDecimals,
    quoteDecimals: priceDecimals,
    roundId,
    answeredInRound,
    maxFutureSkewSec: RULE.maxFutureSkewSec,
  });
  const gap = price.gapBps === undefined ? null : Number(price.gapBps);
  if (!price.ok) return wait(price.code, price.reason, { pool, gapBps: gap });

  const minOut = computeMinOut({ stockAmount, quotedOut, refPrice, tokenDecimals, usdcDecimals, priceDecimals, slippageBps: RULE.slippageBps, maxGapBps: RULE.maxGapBps });
  // Fair floor: the Chainlink value of the stock minus maxGapBps. The least a sale on ANY route (e.g. Bankr's
  // swap, after its fees) may pay and still be fair. minUsdcOut is stricter: it is for the Aerodrome pool quoted here.
  const fairFloor = ceilDiv(usdcValue({ stockAmount, price: refPrice, tokenDecimals, usdcDecimals, priceDecimals }) * (10_000n - RULE.maxGapBps), 10_000n);
  return {
    status: 200,
    body: {
      verdict: 'sell',
      reason: null,
      detail: `quote is ${gap} bps from the reference`,
      ...base,
      pool,
      gapBps: gap,
      sell: { stockAmount: formatUnits(stockAmount, tokenDecimals), minUsdcOut: formatUnits(minOut, usdcDecimals), fairFloorUsdc: formatUnits(fairFloor, usdcDecimals) },
    },
  };
}

/** The record sent to Holdtil's /internal/checks for /proof. Only public facts. */
export function checkRecord({ checkId, payer, body }) {
  return {
    checkId,
    payer: typeof payer === 'string' && /^0x[0-9a-fA-F]{40}$/.test(payer) ? payer.toLowerCase() : null,
    stock: body.stock.symbol,
    forUsdc: body.forUsdc,
    verdict: body.verdict,
    reason: body.reason,
    gapBps: body.gapBps ?? null,
    refUsd: body.reference.usd,
    ageSec: body.reference.ageSec,
    block: body.block,
    checkedAt: body.checkedAt,
  };
}

/** Sends the record. Never throws: a failed record must not change the paid answer. Logs the failure. */
export async function sendRecord({ fetchFn = fetch, url, secret, record, timeoutMs = 3000 }) {
  if (!url || !secret) return { sent: false, why: 'not configured' };
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-check-secret': secret },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.error('[fair-price] record refused', res.status);
      return { sent: false, why: `status ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error('[fair-price] record failed', e?.name ?? 'error');
    return { sent: false, why: 'network' };
  }
}
