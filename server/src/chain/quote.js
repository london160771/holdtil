// DEX quote for selling a stock for USDC on the allowlisted Aerodrome pool. Read-only (eth_call).
import { quoterAbi } from './abis.js';
import { ADDRESSES, POOLS, isAllowlisted } from '../config/addresses.js';
import { HoldtilError } from '../errors.js';

export async function quoteSell(client, stock, amountIn) {
  if (typeof amountIn !== 'bigint' || amountIn <= 0n) throw new RangeError('amountIn must be a positive bigint');
  const pool = Object.values(POOLS).find((p) => p.address === stock.pool?.address);
  if (!isAllowlisted(stock.address) || !pool || pool.tickSpacing !== stock.pool.tickSpacing) {
    throw new HoldtilError('invalid_input', 'stock or pool not allowlisted');
  }
  const { result } = await client.simulateContract({
    address: ADDRESSES.AERO_CL_QUOTER,
    abi: quoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{ tokenIn: stock.address, tokenOut: ADDRESSES.USDC, amountIn, tickSpacing: stock.pool.tickSpacing, sqrtPriceLimitX96: 0n }],
  });
  return { amountIn, amountOut: result[0], pool: stock.pool.address };
}
