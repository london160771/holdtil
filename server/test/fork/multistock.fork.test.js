// Multi-stock refill batch on REAL Base mainnet state via eth_simulateV1 (PRD §16; B20 needs a real node). Nothing is broadcast.
// For every stock other than NVDAc (covered in executor.fork.test.js): real Chainlink reference, real Aerodrome quote,
// the executor's own batch and min-out, the real CDP spender. A throwaway user wallet is funded inside the simulation.
import { describe, it, expect, beforeAll } from 'vitest';
import { encodeAbiParameters, encodeFunctionData, getAddress, hashTypedData, numberToHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ADDRESSES, STOCKS, CHAIN_ID } from '../../src/config/addresses.js';
import { EXECUTOR } from '../../src/config/executor.js';
import { getPublicClient } from '../../src/chain/client.js';
import { erc20Abi, factoryAbi, feedAbi } from '../../src/chain/abis.js';
import { buildRefillCalls } from '../../src/chain/refillBatch.js';
import { simulateSpenderBatch } from '../../src/chain/executorChain.js';
import { loadSpender } from '../../src/chain/spender.js';
import { readReference } from '../../src/chain/priceFeed.js';
import { readDecimals } from '../../src/chain/balances.js';
import { quoteSell } from '../../src/chain/quote.js';
import { permissionHash } from '../../src/chain/spendPermission.js';
import { stockAmountForUsdc, minOut as computeMinOut } from '../../src/core/refillPlanner.js';

const client = getPublicClient();
const SPM = ADDRESSES.SPEND_PERMISSION_MANAGER;
const SPENDER_ADDRESS = process.env.SPENDER_ADDRESS || '0xb7F3c5F916359B303d3ecEbB39f47969444fd15B';
const ANYONE = '0x000000000000000000000000000000000000dEaD';
const ownerBytes = (a) => encodeAbiParameters([{ type: 'address' }], [a]);
const call = (from, to, abi, functionName, args) => ({ from, to, data: encodeFunctionData({ abi, functionName, args }) });
const OTHERS = Object.values(STOCKS).filter((s) => s.symbol !== 'NVDAc');

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
beforeAll(async () => {
  spender = await loadSpender(SPENDER_ADDRESS);
});

describe('multi-stock refill batch on Base mainnet state (eth_simulateV1, nothing sent)', () => {
  it.each(OTHERS.map((s) => [s.symbol, s]))('%s: config matches chain (decimals, feed name, pool fee)', async (sym, stock) => {
    expect(await readDecimals(client, stock.address)).toBe(stock.decimals);
    const desc = await client.readContract({ address: stock.feed, abi: [...feedAbi, { type: 'function', name: 'description', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }], functionName: 'description' });
    expect(desc).toBe(`Coinbase ${sym.replace(/c$/, '')}`);
    const fee = await client.readContract({ address: stock.pool.address, abi: [{ type: 'function', name: 'fee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] }], functionName: 'fee' });
    expect(Number(fee)).toBe(stock.pool.fee);
  });

  it.each(OTHERS.map((s) => [s.symbol, s]))('%s: $1 refill → USDC ≥ min-out lands in the agent wallet', async (sym, stock) => {
    const now = (await client.getBlock()).timestamp;
    const userOwner = privateKeyToAccount(generatePrivateKey());
    const owners = [ownerBytes(userOwner.address), ownerBytes(SPM)];
    const userWallet = await client.readContract({ address: ADDRESSES.SMART_WALLET_FACTORY, abi: factoryAbi, functionName: 'getAddress', args: [owners, 0n] });
    const agentWallet = privateKeyToAccount(generatePrivateKey()).address;
    const permission = {
      account: getAddress(userWallet), spender: spender.address, token: stock.address, allowance: 5_000_000n,
      period: 86_400, start: Number(now - 60n), end: Number(now + 30n * 86_400n), salt: 9n, extraData: '0x',
    };
    const signature = await smartWalletSign(userOwner, userWallet, permissionHash(permission));
    const ref = await readReference(client, stock);
    const stockAmount = stockAmountForUsdc({ usdc: 1_000_000n, refPrice: ref.answer, tokenDecimals: 8, usdcDecimals: 6, priceDecimals: ref.decimals, bufferBps: EXECUTOR.bufferBps });
    const { amountOut: quotedOut } = await quoteSell(client, stock, stockAmount);
    const minOut = computeMinOut({ stockAmount, quotedOut, refPrice: ref.answer, tokenDecimals: 8, usdcDecimals: 6, priceDecimals: ref.decimals, slippageBps: EXECUTOR.slippageBps, maxGapBps: EXECUTOR.maxGapBps });
    // Fund the throwaway wallet with real stock taken from the pool (pool code blanked for one block, then restored).
    const poolCode = await client.getCode({ address: stock.pool.address });
    const fund = {
      stateOverrides: { [stock.pool.address]: { code: '0x' }, [userOwner.address]: { balance: numberToHex(10n ** 18n) } },
      calls: [call(ANYONE, ADDRESSES.SMART_WALLET_FACTORY, factoryAbi, 'createAccount', [owners, 0n]), call(stock.pool.address, stock.address, erc20Abi, 'transfer', [userWallet, stockAmount * 2n])],
    };
    const calls = buildRefillCalls({ stock, permission, signature, needsApproval: true, stockAmount, minOut, recipient: agentWallet, deadline: now + EXECUTOR.deadlineSec, spender: spender.address });
    const r = await simulateSpenderBatch(client, { spender, calls, agentWallet, preBlocks: [fund], overrides: { [stock.pool.address]: { code: poolCode } } });
    expect(r.ok).toBe(true);
    expect(r.usdcOut).toBeGreaterThanOrEqual(minOut);
    console.log(`[fork] ${sym}: sold ${stockAmount} units → agent USDC ${r.usdcOut}, min-out ${minOut}, gas ${r.gasUsed}`);
  });
});
