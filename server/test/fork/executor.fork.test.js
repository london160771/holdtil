// Executor batch on REAL Base mainnet state via eth_simulateV1 (PRD §16: Anvil can't run B20). Nothing is broadcast.
// Uses the real CDP spender (needs CDP_* env; its keys stay in CDP), a throwaway user smart wallet funded in the
// simulation, the real Chainlink reference, the real Aerodrome quote, and the executor's own batch builder and min-out.
import { describe, it, expect, beforeAll } from 'vitest';
import { encodeAbiParameters, encodeFunctionData, getAddress, hashTypedData, numberToHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ADDRESSES, STOCKS, CHAIN_ID } from '../../src/config/addresses.js';
import { EXECUTOR } from '../../src/config/executor.js';
import { getPublicClient } from '../../src/chain/client.js';
import { erc20Abi, factoryAbi, smartWalletAbi, spendPermissionManagerAbi } from '../../src/chain/abis.js';
import { buildRefillCalls } from '../../src/chain/refillBatch.js';
import { simulateSpenderBatch } from '../../src/chain/executorChain.js';
import { builderCodeSuffix } from '../../src/chain/builderCode.js';
import { loadSpender } from '../../src/chain/spender.js';
import { readReference } from '../../src/chain/priceFeed.js';
import { quoteSell } from '../../src/chain/quote.js';
import { permissionHash } from '../../src/chain/spendPermission.js';
import { stockAmountForUsdc, minOut as computeMinOut } from '../../src/core/refillPlanner.js';

const client = getPublicClient();
const stock = STOCKS.NVDAc;
const SPM = ADDRESSES.SPEND_PERMISSION_MANAGER;
const SPENDER_ADDRESS = process.env.SPENDER_ADDRESS || '0xb7F3c5F916359B303d3ecEbB39f47969444fd15B';
const ANYONE = '0x000000000000000000000000000000000000dEaD';
const ownerBytes = (a) => encodeAbiParameters([{ type: 'address' }], [a]);
const call = (from, to, abi, functionName, args) => ({ from, to, data: encodeFunctionData({ abi, functionName, args }) });

async function smartWalletSign(owner, wallet, hash) {
  const replaySafe = hashTypedData({
    domain: { name: 'Coinbase Smart Wallet', version: '1', chainId: CHAIN_ID, verifyingContract: wallet },
    types: { CoinbaseSmartWalletMessage: [{ name: 'hash', type: 'bytes32' }] },
    primaryType: 'CoinbaseSmartWalletMessage',
    message: { hash },
  });
  const signatureData = await owner.sign({ hash: replaySafe });
  return encodeAbiParameters(
    [{ type: 'tuple', components: [{ name: 'ownerIndex', type: 'uint256' }, { name: 'signatureData', type: 'bytes' }] }],
    [{ ownerIndex: 0n, signatureData }],
  );
}

let spender;
let ctx;

beforeAll(async () => {
  spender = await loadSpender(SPENDER_ADDRESS);
  const block = await client.getBlock();
  const now = block.timestamp;
  const userOwner = privateKeyToAccount(generatePrivateKey());
  const owners = [ownerBytes(userOwner.address), ownerBytes(SPM)];
  const userWallet = await client.readContract({ address: ADDRESSES.SMART_WALLET_FACTORY, abi: factoryAbi, functionName: 'getAddress', args: [owners, 0n] });
  const agentWallet = privateKeyToAccount(generatePrivateKey()).address;
  const permission = {
    account: getAddress(userWallet), spender: spender.address, token: stock.address, allowance: 5_000_000n,
    period: 86_400, start: Number(now - 60n), end: Number(now + 30n * 86_400n), salt: 7n, extraData: '0x',
  };
  const signature = await smartWalletSign(userOwner, userWallet, permissionHash(permission));

  // Size the sale the way the executor does: $1 at the reference price + fee buffer.
  const ref = await readReference(client, stock);
  const stockAmount = stockAmountForUsdc({ usdc: 1_000_000n, refPrice: ref.answer, tokenDecimals: 8, usdcDecimals: 6, priceDecimals: ref.decimals, bufferBps: EXECUTOR.bufferBps });
  const { amountOut: quotedOut } = await quoteSell(client, stock, stockAmount);
  const minOut = computeMinOut({ stockAmount, quotedOut, refPrice: ref.answer, tokenDecimals: 8, usdcDecimals: 6, priceDecimals: ref.decimals, slippageBps: EXECUTOR.slippageBps, maxGapBps: EXECUTOR.maxGapBps });
  const quoteMin = (quotedOut * (10_000n - EXECUTOR.slippageBps)) / 10_000n;

  // Setup: deploy the user wallet and fund it with real NVDAc taken from the pool (pool code blanked for one block).
  const poolCode = await client.getCode({ address: stock.pool.address });
  const fund = {
    stateOverrides: { [stock.pool.address]: { code: '0x' }, [userOwner.address]: { balance: numberToHex(10n ** 18n) } },
    calls: [call(ANYONE, ADDRESSES.SMART_WALLET_FACTORY, factoryAbi, 'createAccount', [owners, 0n]), call(stock.pool.address, stock.address, erc20Abi, 'transfer', [userWallet, 10_000_000n])],
  };
  ctx = { now, userOwner, userWallet, agentWallet, permission, signature, ref, stockAmount, quotedOut, minOut, quoteMin, fund, restore: { [stock.pool.address]: { code: poolCode } } };
});

const calls = (over = {}) =>
  buildRefillCalls({
    stock, permission: ctx.permission, signature: ctx.signature, needsApproval: true, stockAmount: ctx.stockAmount,
    minOut: ctx.minOut, recipient: ctx.agentWallet, deadline: ctx.now + EXECUTOR.deadlineSec, spender: spender.address, ...over,
  });

describe('executor batch on Base mainnet state (eth_simulateV1, nothing sent)', () => {
  it('spender matches SPENDER_ADDRESS (CDP Coinbase Smart Wallet)', () => {
    expect(spender.address).toBe(getAddress(SPENDER_ADDRESS));
  });

  it('happy path: real reference, real quote, executor min-out → USDC ≥ min-out lands in the agent wallet', async () => {
    // A weekend or a big pool move would make the executor wait before this point; the batch itself must still be valid.
    const r = await simulateSpenderBatch(client, { spender, calls: calls(), agentWallet: ctx.agentWallet, preBlocks: [ctx.fund], overrides: ctx.restore });
    expect(r.ok).toBe(true);
    expect(r.usdcOut).toBeGreaterThanOrEqual(ctx.minOut);
    console.log('[fork] sold', ctx.stockAmount, 'NVDAc units → agent USDC', r.usdcOut, 'min-out', ctx.minOut, 'gas', r.gasUsed);
  });

  it('builder-code suffix (ERC-8021) on the batch calldata changes nothing: same USDC to the agent', async () => {
    const plain = await simulateSpenderBatch(client, { spender, calls: calls(), agentWallet: ctx.agentWallet, preBlocks: [ctx.fund], overrides: ctx.restore });
    const tagged = await simulateSpenderBatch(client, { spender, calls: calls(), agentWallet: ctx.agentWallet, preBlocks: [ctx.fund], overrides: ctx.restore, dataSuffix: builderCodeSuffix('bc_b7k3p9da') });
    expect(tagged.ok).toBe(true);
    expect(tagged.usdcOut).toBe(plain.usdcOut);
    console.log('[fork] builder code: gas', plain.gasUsed, '→', tagged.gasUsed);
  });

  it('min-out uses the reference floor: never below reference − maxGapBps', () => {
    expect(ctx.minOut).toBeGreaterThanOrEqual(ctx.quoteMin);
  });

  it('min-out above what the pool pays → the whole batch reverts, agent gets nothing', async () => {
    const r = await simulateSpenderBatch(client, { spender, calls: calls({ minOut: ctx.quotedOut * 2n }), agentWallet: ctx.agentWallet, preBlocks: [ctx.fund], overrides: ctx.restore });
    expect(r.ok).toBe(false);
  });

  it('lab #5: user revoked the permission → batch reverts', async () => {
    const revoke = encodeFunctionData({ abi: spendPermissionManagerAbi, functionName: 'revoke', args: [ctx.permission] });
    const approve = encodeFunctionData({ abi: spendPermissionManagerAbi, functionName: 'approveWithSignature', args: [ctx.permission, ctx.signature] });
    const pre = [
      ctx.fund,
      { stateOverrides: ctx.restore, calls: [{ from: ANYONE, to: SPM, data: approve }, call(ctx.userOwner.address, ctx.userWallet, smartWalletAbi, 'execute', [SPM, 0n, revoke])] },
    ];
    const r = await simulateSpenderBatch(client, { spender, calls: calls({ needsApproval: false }), agentWallet: ctx.agentWallet, preBlocks: pre });
    expect(r.ok).toBe(false);
  });

  it('over the allowance → batch builder refuses before anything is simulated', () => {
    expect(() => calls({ stockAmount: ctx.permission.allowance + 1n })).toThrow(/allowance/);
  });

  it('user-paid gas fee (FR-RFL-006): one batch pays the agent ≥ min-out and the fee wallet ≥ fee min-out', async () => {
    const feeWallet = privateKeyToAccount(generatePrivateKey()).address;
    const feeStock = stockAmountForUsdc({ usdc: 20_000n, refPrice: ctx.ref.answer, tokenDecimals: 8, usdcDecimals: 6, priceDecimals: ctx.ref.decimals, bufferBps: 0n });
    // Same as the executor: fee min-out from the reference floor only (quotedOut 0n).
    const feeMinOut = computeMinOut({ stockAmount: feeStock, quotedOut: 0n, refPrice: ctx.ref.answer, tokenDecimals: 8, usdcDecimals: 6, priceDecimals: ctx.ref.decimals, slippageBps: EXECUTOR.slippageBps, maxGapBps: EXECUTOR.maxGapBps });
    const plain = await simulateSpenderBatch(client, { spender, calls: calls(), agentWallet: ctx.agentWallet, preBlocks: [ctx.fund], overrides: ctx.restore });
    const r = await simulateSpenderBatch(client, { spender, calls: calls({ fee: { wallet: feeWallet, stockAmount: feeStock, minOut: feeMinOut } }), agentWallet: ctx.agentWallet, feeWallet, preBlocks: [ctx.fund], overrides: ctx.restore });
    expect(r.ok).toBe(true);
    expect(r.usdcOut).toBeGreaterThanOrEqual(ctx.minOut);
    expect(r.usdcOut).toBe(plain.usdcOut); // the agent's sale runs first, so the fee never changes what the agent gets
    expect(r.feeOut).toBeGreaterThanOrEqual(feeMinOut);
    console.log('[fork] gas fee: sold', feeStock, 'NVDAc units → fee wallet USDC', r.feeOut, 'min-out', feeMinOut, 'gas', plain.gasUsed, '→', r.gasUsed);
  });

  it('bigger refill (most of the allowance) + fee: the fee still clears its min-out after the agent swap moves the pool', async () => {
    const feeWallet = privateKeyToAccount(generatePrivateKey()).address;
    const feeStock = stockAmountForUsdc({ usdc: 50_000n, refPrice: ctx.ref.answer, tokenDecimals: 8, usdcDecimals: 6, priceDecimals: ctx.ref.decimals, bufferBps: 0n });
    const big = ctx.permission.allowance - feeStock;
    const { amountOut: bigQuoted } = await quoteSell(client, stock, big);
    const common = { refPrice: ctx.ref.answer, tokenDecimals: 8, usdcDecimals: 6, priceDecimals: ctx.ref.decimals, slippageBps: EXECUTOR.slippageBps, maxGapBps: EXECUTOR.maxGapBps };
    const bigMin = computeMinOut({ ...common, stockAmount: big, quotedOut: bigQuoted });
    const feeMinOut = computeMinOut({ ...common, stockAmount: feeStock, quotedOut: 0n });
    const r = await simulateSpenderBatch(client, { spender, calls: calls({ stockAmount: big, minOut: bigMin, fee: { wallet: feeWallet, stockAmount: feeStock, minOut: feeMinOut } }), agentWallet: ctx.agentWallet, feeWallet, preBlocks: [ctx.fund], overrides: ctx.restore });
    expect(r.ok).toBe(true);
    expect(r.feeOut).toBeGreaterThanOrEqual(feeMinOut);
    console.log('[fork] big refill: agent USDC', r.usdcOut, '+ fee', r.feeOut, 'fee min-out', feeMinOut);
  });

  it('gas fee min-out above what the pool pays → whole batch reverts, agent gets nothing either', async () => {
    const feeWallet = privateKeyToAccount(generatePrivateKey()).address;
    const r = await simulateSpenderBatch(client, { spender, calls: calls({ fee: { wallet: feeWallet, stockAmount: 1_000n, minOut: 10_000_000n } }), agentWallet: ctx.agentWallet, feeWallet, preBlocks: [ctx.fund], overrides: ctx.restore });
    expect(r.ok).toBe(false);
  });

  it('lab #7: destination is fixed to the agent wallet (user wallet / spender / contracts refused)', () => {
    for (const recipient of [ctx.userWallet, spender.address, ADDRESSES.AERO_CL_SWAP_ROUTER, stock.pool.address]) {
      expect(() => calls({ recipient })).toThrow();
    }
  });
});
