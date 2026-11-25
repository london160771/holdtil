// Reads the Chainlink reference price for a stock (PRD §15). Read-only. Returns raw bigint values;
// freshness is decided by core/priceGuard, never here.
import { feedAbi } from './abis.js';
import { isAllowlisted } from '../config/addresses.js';
import { HoldtilError } from '../errors.js';

export async function readReference(client, stock) {
  if (!isAllowlisted(stock.feed)) throw new HoldtilError('invalid_input', 'feed not allowlisted');
  const [decimals, round] = await Promise.all([
    client.readContract({ address: stock.feed, abi: feedAbi, functionName: 'decimals' }),
    client.readContract({ address: stock.feed, abi: feedAbi, functionName: 'latestRoundData' }),
  ]);
  const [roundId, answer, , updatedAt, answeredInRound] = round;
  return { feed: stock.feed, decimals: Number(decimals), roundId, answer, updatedAt, answeredInRound };
}
