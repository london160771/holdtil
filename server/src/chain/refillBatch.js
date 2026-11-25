// Builds the spender's refill batch (PRD §9, CLAUDE.md §9). Pure: encodes calls, sends nothing.
// Batch = [approveWithSignature (first time only)] + spend + approve(router) + exactInputSingle(recipient = agent wallet).
import { encodeFunctionData, getAddress, isAddress } from 'viem';
import { ADDRESSES, isAllowlisted } from '../config/addresses.js';
import { HoldtilError } from '../errors.js';
import { erc20Abi, routerAbi, spendPermissionManagerAbi } from './abis.js';

const bad = (msg) => new HoldtilError('invalid_input', msg);

/**
 * @param {object} p
 * @param {object} p.stock       entry from STOCKS (address, pool)
 * @param {object} p.permission  typed permission (bigints) from the DB
 * @param {string} p.signature   the user's permission signature (used only when needsApproval)
 * @param {boolean} p.needsApproval  true when SPM.isApproved is false
 * @param {bigint} p.stockAmount token base units to pull and sell
 * @param {bigint} p.minOut      USDC base units; swap reverts below this
 * @param {string} p.recipient   the agent wallet FROM THE DB RECORD (INV-5)
 * @param {bigint} p.deadline    unix seconds
 * @param {string} p.spender     Holdtil spender address (must equal permission.spender)
 */
export function buildRefillCalls({ stock, permission, signature, needsApproval, stockAmount, minOut, recipient, deadline, spender }) {
  if (typeof stockAmount !== 'bigint' || stockAmount <= 0n) throw bad('stockAmount must be > 0');
  if (typeof minOut !== 'bigint' || minOut <= 0n) throw bad('minOut must be > 0');
  if (typeof deadline !== 'bigint' || deadline <= 0n) throw bad('deadline required');
  if (typeof recipient !== 'string' || !isAddress(recipient, { strict: false })) throw bad('recipient is not an address');
  const to = getAddress(recipient);
  // INV-5: USDC never goes to a contract we know (token, pool, router, SPM...), the spender or the user.
  if (isAllowlisted(to)) throw bad('recipient cannot be a known contract');
  if (to === getAddress(spender) || to === getAddress(permission.account)) throw bad('recipient must be the agent wallet');
  // INV-6: every target is on the allowlist and matches the permission.
  for (const a of [stock.address, ADDRESSES.SPEND_PERMISSION_MANAGER, ADDRESSES.AERO_CL_SWAP_ROUTER]) {
    if (!isAllowlisted(a)) throw bad(`not allowlisted: ${a}`);
  }
  if (getAddress(permission.token) !== getAddress(stock.address)) throw bad('permission token does not match the stock');
  if (getAddress(permission.spender) !== getAddress(spender)) throw bad('permission spender is not Holdtil');
  if (stockAmount > permission.allowance) throw bad('stockAmount is over the permission allowance');

  const SPM = ADDRESSES.SPEND_PERMISSION_MANAGER;
  const calls = [];
  if (needsApproval) {
    if (typeof signature !== 'string' || !signature.startsWith('0x')) throw bad('signature required for first-time approval');
    calls.push({ to: SPM, value: 0n, data: encodeFunctionData({ abi: spendPermissionManagerAbi, functionName: 'approveWithSignature', args: [permission, signature] }) });
  }
  calls.push({ to: SPM, value: 0n, data: encodeFunctionData({ abi: spendPermissionManagerAbi, functionName: 'spend', args: [permission, stockAmount] }) });
  calls.push({ to: stock.address, value: 0n, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [ADDRESSES.AERO_CL_SWAP_ROUTER, stockAmount] }) });
  calls.push({
    to: ADDRESSES.AERO_CL_SWAP_ROUTER,
    value: 0n,
    data: encodeFunctionData({
      abi: routerAbi,
      functionName: 'exactInputSingle',
      args: [{ tokenIn: stock.address, tokenOut: ADDRESSES.USDC, tickSpacing: stock.pool.tickSpacing, recipient: to, deadline, amountIn: stockAmount, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
    }),
  });
  return calls;
}
