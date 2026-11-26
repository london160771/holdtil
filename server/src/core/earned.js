// "Earned while waiting" (owner-approved feature 1, PRD §16). Pure bigint math, display only; never used to decide a sale.
// Compares the budget kept in stock with the same stock turned into idle USDC at the start price:
//   kept = stock still held × price now + USDC the refills already paid out
//   idle = (stock still held + stock sold) × start price
//   earned = kept − idle   (can be negative: stocks can go down)
import { assertUnits, pow10 } from './money.js';

const USDC_DECIMALS = 6;

/** USDC base units for `amount` token base units at `price` (feed units). Rounded down. */
export function usdcValue(amount, price, tokenDecimals, priceDecimals) {
  assertUnits(amount, 'amount');
  assertUnits(price, 'price');
  const shift = tokenDecimals + priceDecimals - USDC_DECIMALS;
  if (!Number.isInteger(shift) || shift < 0) throw new RangeError('unsupported decimals');
  return (amount * price) / pow10(shift);
}

/**
 * @returns {{keptUsdc:bigint, idleUsdc:bigint, earnedUsdc:bigint, earnedBps:bigint|null}}
 */
export function earnedWhileWaiting({ heldStock, soldStock, usdcFromSales, startPrice, nowPrice, tokenDecimals, priceDecimals }) {
  assertUnits(usdcFromSales, 'usdcFromSales');
  if (startPrice <= 0n || nowPrice <= 0n) throw new RangeError('prices must be > 0');
  const keptUsdc = usdcValue(heldStock, nowPrice, tokenDecimals, priceDecimals) + usdcFromSales;
  const idleUsdc = usdcValue(heldStock + soldStock, startPrice, tokenDecimals, priceDecimals);
  const earnedUsdc = keptUsdc - idleUsdc;
  return { keptUsdc, idleUsdc, earnedUsdc, earnedBps: idleUsdc > 0n ? (earnedUsdc * 10_000n) / idleUsdc : null };
}
