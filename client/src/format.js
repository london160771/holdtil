// Display helpers. Money arrives as base-unit strings; we never do money math in floats.
import { formatUnits, parseUnits } from 'viem';

export function usd(baseUnits) {
  if (baseUnits === null || baseUnits === undefined || baseUnits === 'unavailable') return 'unavailable';
  const s = formatUnits(BigInt(baseUnits), 6);
  const [w, f = ''] = s.split('.');
  return `$${w}.${(f + '00').slice(0, 2)}`;
}

export function tokenAmount(baseUnits, decimals, symbol) {
  if (baseUnits === null || baseUnits === undefined || baseUnits === 'unavailable') return 'unavailable';
  return `${formatUnits(BigInt(baseUnits), decimals)} ${symbol}`;
}

/** "2.50" (dollars) → "2500000". Throws on bad input. */
export function usdToUnits(value) {
  const v = String(value).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(v)) throw new Error('Enter an amount like 2.50');
  return parseUnits(v, 6).toString();
}

export function unitsToUsdInput(baseUnits) {
  return formatUnits(BigInt(baseUnits), 6);
}

export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
