// Gate 0 premises 3 + 4 (PRD §16), read-only against Base mainnet:
//   3. A fresh Chainlink reference price for NVDA exists on Base and can be read with its timestamp.
//   4. A DEX quote for selling a small NVDAc amount is available (execution is proven in spend-batch-sim.js).
import { ADDRESSES, STOCKS } from '../../src/config/addresses.js';
import { publicClient, erc20Abi, feedAbi, quoterAbi, gapBps, toJson } from './lib.js';

const MAX_PRICE_AGE_SEC = 3600n; // Gate 0 check only; real limit is a per-user setting (PRD §11 INV-2)

export async function readPriceAndQuote({ amountIn = 1_000_000n } = {}) {
  const client = publicClient();
  const stock = STOCKS.NVDAc;
  const block = await client.getBlock();

  const [tokenDecimals, usdcDecimals, feedDecimals, description, round] = await Promise.all([
    client.readContract({ address: stock.address, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address: ADDRESSES.USDC, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address: stock.feed, abi: feedAbi, functionName: 'decimals' }),
    client.readContract({ address: stock.feed, abi: feedAbi, functionName: 'description' }),
    client.readContract({ address: stock.feed, abi: feedAbi, functionName: 'latestRoundData' }),
  ]);
  const [roundId, answer, , updatedAt] = round;
  const ageSec = block.timestamp - updatedAt;

  const { result } = await client.simulateContract({
    address: ADDRESSES.AERO_CL_QUOTER,
    abi: quoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{ tokenIn: stock.address, tokenOut: ADDRESSES.USDC, amountIn, tickSpacing: stock.pool.tickSpacing, sqrtPriceLimitX96: 0n }],
  });
  const usdcOut = result[0];

  // Quote price per 1 whole token, in feed decimals: usdcOut / amountIn scaled. bigint only.
  const quotePrice =
    (usdcOut * 10n ** BigInt(feedDecimals) * 10n ** BigInt(tokenDecimals)) /
    (amountIn * 10n ** BigInt(usdcDecimals));
  const gap = gapBps(quotePrice, answer);

  return {
    blockNumber: block.number,
    blockTime: new Date(Number(block.timestamp) * 1000).toISOString(),
    token: { address: stock.address, decimals: tokenDecimals },
    usdcDecimals,
    feed: {
      address: stock.feed,
      description,
      decimals: feedDecimals,
      roundId,
      answer,
      updatedAt: new Date(Number(updatedAt) * 1000).toISOString(),
      ageSec,
      fresh: ageSec >= 0n && ageSec <= MAX_PRICE_AGE_SEC,
    },
    quote: {
      quoter: ADDRESSES.AERO_CL_QUOTER,
      pool: stock.pool.address,
      amountIn,
      usdcOut,
      quotePrice,
      gapBps: gap,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  readPriceAndQuote()
    .then((r) => console.log(toJson(r)))
    .catch((e) => {
      console.error('price-and-quote failed:', e.message);
      process.exitCode = 1;
    });
}
