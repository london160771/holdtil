// Fresh on-chain balances. Never cache these for decisions (B20 multiplier can change; CLAUDE.md §9).
import { erc20Abi } from './abis.js';
import { isAllowlisted } from '../config/addresses.js';
import { HoldtilError } from '../errors.js';

export async function readDecimals(client, token) {
  if (!isAllowlisted(token)) throw new HoldtilError('invalid_input', 'token not allowlisted');
  return Number(await client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }));
}

export async function readBalance(client, token, holder) {
  if (!isAllowlisted(token)) throw new HoldtilError('invalid_input', 'token not allowlisted');
  return client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [holder] });
}
