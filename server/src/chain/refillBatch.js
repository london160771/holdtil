// Builds the spender's refill batch (PRD §9, CLAUDE.md §9). Pure: encodes calls, sends nothing.
// Batch = [approveWithSignature (first time only)] + spend + approve(router) + exactInputSingle(recipient = agent wallet)
// [+ exactInputSingle(recipient = fee wallet): the user-paid gas fee, its own min-out (PRD INV-5, FR-RFL-006)].
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
 * @param {object} [p.fee]       optional gas fee: { wallet (FEE_WALLET from config), stockAmount, minOut }
 */
export function buildRefillCalls({ stock, permission, signature, needsApproval, stockAmount, minOut, recipient, deadline, spender, fee }) {
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
  let feeTo = null;
  if (fee) {
    if (typeof fee.stockAmount !== 'bigint' || fee.stockAmount <= 0n) throw bad('fee stockAmount must be > 0');
    if (typeof fee.minOut !== 'bigint' || fee.minOut <= 0n) throw bad('fee minOut must be > 0');
    if (typeof fee.wallet !== 'string' || !isAddress(fee.wallet, { strict: false })) throw bad('fee wallet is not an address');
    feeTo = getAddress(fee.wallet);
    // The fee wallet is Holdtil's own gas-refund wallet: never a known contract, the spender, the user or this agent.
    if (isAllowlisted(feeTo)) throw bad('fee wallet cannot be a known contract');
    if (feeTo === getAddress(spender) || feeTo === getAddress(permission.account) || feeTo === to) throw bad('fee wallet must be a separate wallet');
  }
  const total = stockAmount + (fee ? fee.stockAmount : 0n);
  if (total > permission.allowance) throw bad('stockAmount is over the permission allowance');

  const SPM = ADDRESSES.SPEND_PERMISSION_MANAGER;
  const calls = [];
  if (needsApproval) {
    if (typeof signature !== 'string' || !signature.startsWith('0x')) throw bad('signature required for first-time approval');
    calls.push({ to: SPM, value: 0n, data: encodeFunctionData({ abi: spendPermissionManagerAbi, functionName: 'approveWithSignature', args: [permission, signature] }) });
  }
  // One pull and one approve for both sales, so the spender ends the batch holding nothing.
  calls.push({ to: SPM, value: 0n, data: encodeFunctionData({ abi: spendPermissionManagerAbi, functionName: 'spend', args: [permission, total] }) });
  calls.push({ to: stock.address, value: 0n, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [ADDRESSES.AERO_CL_SWAP_ROUTER, total] }) });
  const swap = (recipientAddr, amountIn, amountOutMinimum) => ({
    to: ADDRESSES.AERO_CL_SWAP_ROUTER,
    value: 0n,
    data: encodeFunctionData({
      abi: routerAbi,
      functionName: 'exactInputSingle',
      args: [{ tokenIn: stock.address, tokenOut: ADDRESSES.USDC, tickSpacing: stock.pool.tickSpacing, recipient: recipientAddr, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n }],
    }),
  });
  // The agent's sale goes first, so the fee sale never moves the agent's price.
  calls.push(swap(to, stockAmount, minOut));
  if (fee) calls.push(swap(feeTo, fee.stockAmount, fee.minOut));
  return calls;
}
