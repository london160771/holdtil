// DEX quote for selling a stock for USDC on the allowlisted Aerodrome pool. Read-only (eth_call).
import { quoterAbi } from './abis.js';
import { ADDRESSES } from '../config/addresses.js';

export async function quoteSell(client, stock, amountIn) {
  if (typeof amountIn !== 'bigint' || amountIn <= 0n) throw new RangeError('amountIn must be a positive bigint');
  const { result } = await client.simulateContract({
    address: ADDRESSES.AERO_CL_QUOTER,
    abi: quoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{ tokenIn: stock.address, tokenOut: ADDRESSES.USDC, amountIn, tickSpacing: stock.pool.tickSpacing, sqrtPriceLimitX96: 0n }],
  });
  return { amountIn, amountOut: result[0], pool: stock.pool.address };
}
