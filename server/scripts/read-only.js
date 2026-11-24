// Phase 1 read-only check (PRD §27): prints real Base mainnet balances and prices. Sends nothing.
// Usage: node scripts/read-only.js [address ...]   (defaults to the NVDAc/USDC pool)
import { getAddress, formatUnits } from 'viem';
import { ADDRESSES, STOCKS } from '../src/config/addresses.js';
import { getPublicClient } from '../src/chain/client.js';
import { readReference } from '../src/chain/priceFeed.js';
import { readBalance, readDecimals } from '../src/chain/balances.js';
import { quoteSell } from '../src/chain/quote.js';
import { checkPrice, quotePriceFromSwap } from '../src/core/priceGuard.js';

const client = getPublicClient();
const stock = STOCKS.NVDAc;
const args = process.argv.slice(2);
const holders = (args.length ? args : [stock.pool.address]).map((a) => getAddress(a));

const block = await client.getBlock();
const [tokenDec, usdcDec, ref] = await Promise.all([
  readDecimals(client, stock.address),
  readDecimals(client, ADDRESSES.USDC),
  readReference(client, stock),
]);
const amountIn = 10n ** BigInt(tokenDec - 2); // 0.01 NVDAc
const q = await quoteSell(client, stock, amountIn);
const quotePrice = quotePriceFromSwap({ amountIn, amountOut: q.amountOut, tokenDecimals: tokenDec, usdcDecimals: usdcDec, priceDecimals: ref.decimals });
const guard = checkPrice({ refPrice: ref.answer, refUpdatedAt: ref.updatedAt, now: block.timestamp, quotePrice, maxPriceAgeSec: 3600n, maxGapBps: 100n, refDecimals: ref.decimals, quoteDecimals: ref.decimals, roundId: ref.roundId, answeredInRound: ref.answeredInRound });

const iso = (sec) => new Date(Number(sec) * 1000).toISOString();
console.log(`Block ${block.number} at ${iso(block.timestamp)}`);
console.log(`NVDA reference: $${formatUnits(ref.answer, ref.decimals)} updated ${iso(ref.updatedAt)} (age ${block.timestamp - ref.updatedAt}s)`);
console.log(`Quote: 0.01 NVDAc -> ${formatUnits(q.amountOut, usdcDec)} USDC (= $${formatUnits(quotePrice, ref.decimals)} per NVDAc)`);
console.log(`Guard (example limits: 1h age, 100 bps): ${guard.ok ? `OK, gap ${guard.gapBps} bps` : `${guard.code}: ${guard.reason}`}`);
for (const h of holders) {
  const [n, u] = await Promise.all([readBalance(client, stock.address, h), readBalance(client, ADDRESSES.USDC, h)]);
  console.log(`${h}: ${formatUnits(n, tokenDec)} NVDAc, ${formatUnits(u, usdcDec)} USDC`);
}
