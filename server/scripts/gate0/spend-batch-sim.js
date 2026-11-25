// Gate 0 premises 1 + 2 (PRD §16), proven by SIMULATION on real Base mainnet state (eth_simulateV1).
//   1. A Spend Permission can be granted on NVDAc (B20) and spent by our spender.
//   2. The spender can do pull → swap (min-out) → send USDC to an agent wallet in ONE atomic batch.
//
// Why not Anvil: B20 tokens are Base-native precompiles. A local Anvil fork cannot run them
// (calls fail with "EVM error OpcodeNotFound"). eth_simulateV1 runs on a real Base node, so the
// B20 precompile, the Spend Permission Manager, the smart wallets and the Aerodrome pool all run for real.
// Nothing is broadcast. No money moves. Keys used here are throwaway, in memory, never printed.
//
// Scenarios (each is its own simulation, from the same real starting state):
//   happy        — approveWithSignature + spend + approve router + swap(min-out) → USDC lands in agent wallet
//   minOutTooHigh — same batch with min-out above the quote → whole batch reverts, user keeps all NVDAc
//   revoked      — user revokes, then the spender tries to spend → reverts
//   overAllowance — spend more than the allowance → reverts
//   wrongSpender — a different address tries to spend the permission → reverts
import {
  encodeAbiParameters,
  encodeFunctionData,
  decodeFunctionResult,
  hashTypedData,
  getAddress,
  numberToHex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ADDRESSES, STOCKS, CHAIN_ID } from '../../src/config/addresses.js';
import {
  publicClient,
  erc20Abi,
  quoterAbi,
  routerAbi,
  spendPermissionManagerAbi,
  smartWalletAbi,
  factoryAbi,
  toJson,
} from './lib.js';

const stock = STOCKS.NVDAc;
const SPM = ADDRESSES.SPEND_PERMISSION_MANAGER;
const ownerBytes = (addr) => encodeAbiParameters([{ type: 'address' }], [addr]);
const call = (from, to, abi, functionName, args) => ({ from, to, data: encodeFunctionData({ abi, functionName, args }) });

function spendPermissionTypedData(permission) {
  return {
    domain: { name: 'Spend Permission Manager', version: '1', chainId: CHAIN_ID, verifyingContract: SPM },
    types: {
      SpendPermission: [
        { name: 'account', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'token', type: 'address' },
        { name: 'allowance', type: 'uint160' },
        { name: 'period', type: 'uint48' },
        { name: 'start', type: 'uint48' },
        { name: 'end', type: 'uint48' },
        { name: 'salt', type: 'uint256' },
        { name: 'extraData', type: 'bytes' },
      ],
    },
    primaryType: 'SpendPermission',
    message: permission,
  };
}

/** Coinbase Smart Wallet signature: owner signs the wallet's replay-safe hash, wrapped with the owner index. */
async function smartWalletSign(ownerAccount, walletAddress, hash) {
  const replaySafe = hashTypedData({
    domain: { name: 'Coinbase Smart Wallet', version: '1', chainId: CHAIN_ID, verifyingContract: walletAddress },
    types: { CoinbaseSmartWalletMessage: [{ name: 'hash', type: 'bytes32' }] },
    primaryType: 'CoinbaseSmartWalletMessage',
    message: { hash },
  });
  const signatureData = await ownerAccount.sign({ hash: replaySafe });
  return encodeAbiParameters(
    [{ type: 'tuple', components: [{ name: 'ownerIndex', type: 'uint256' }, { name: 'signatureData', type: 'bytes' }] }],
    [{ ownerIndex: 0n, signatureData }],
  );
}

async function simulate(client, blockStateCalls) {
  return client.request({
    method: 'eth_simulateV1',
    params: [{ blockStateCalls, validation: false }, 'latest'],
  });
}

function decodeUint(abi, functionName, callResult) {
  if (callResult.status !== '0x1') return null;
  return decodeFunctionResult({ abi, functionName, data: callResult.returnData });
}

export async function runSpendBatchSim({ spenderOwnerAddress, spenderAddress } = {}) {
  const client = publicClient();
  const block = await client.getBlock();
  const now = block.timestamp;

  // Throwaway actors (in-memory keys, never printed).
  const userOwner = privateKeyToAccount(generatePrivateKey());
  const spenderOwner = spenderOwnerAddress ?? privateKeyToAccount(generatePrivateKey()).address;
  const agentWallet = privateKeyToAccount(generatePrivateKey()).address;
  const intruder = privateKeyToAccount(generatePrivateKey()).address;
  const anyone = '0x000000000000000000000000000000000000dEaD';

  // User's smart wallet: owners = [user key, Spend Permission Manager] (how Base Accounts enable spend permissions).
  const userOwners = [ownerBytes(userOwner.address), ownerBytes(SPM)];
  const userWallet = await client.readContract({
    address: ADDRESSES.SMART_WALLET_FACTORY, abi: factoryAbi, functionName: 'getAddress', args: [userOwners, 0n],
  });
  const spenderOwners = [ownerBytes(spenderOwner)];
  const spender =
    spenderAddress ??
    (await client.readContract({
      address: ADDRESSES.SMART_WALLET_FACTORY, abi: factoryAbi, functionName: 'getAddress', args: [spenderOwners, 0n],
    }));

  // Amounts in token base units (INV-1). NVDAc has 8 decimals: 0.05 NVDAc funded, 0.02 allowance, 0.01 sold.
  const funded = 5_000_000n;
  const allowance = 2_000_000n;
  const amount = 1_000_000n;

  const permission = {
    account: userWallet,
    spender,
    token: stock.address,
    allowance,
    period: 86_400,
    start: Number(now - 60n),
    end: Number(now + 86_400n),
    salt: 1n,
    extraData: '0x',
  };
  const permissionHash = hashTypedData(spendPermissionTypedData(permission));
  const onchainHash = await client.readContract({ address: SPM, abi: spendPermissionManagerAbi, functionName: 'getHash', args: [permission] });
  if (onchainHash !== permissionHash) throw new Error('EIP-712 hash mismatch with SpendPermissionManager.getHash');
  const signature = await smartWalletSign(userOwner, userWallet, permissionHash);

  // Real quote → min-out with 50 bps slippage.
  const { result: q } = await client.simulateContract({
    address: ADDRESSES.AERO_CL_QUOTER, abi: quoterAbi, functionName: 'quoteExactInputSingle',
    args: [{ tokenIn: stock.address, tokenOut: ADDRESSES.USDC, amountIn: amount, tickSpacing: stock.pool.tickSpacing, sqrtPriceLimitX96: 0n }],
  });
  const quotedOut = q[0];
  const minOut = (quotedOut * 9_950n) / 10_000n;
  const deadline = now + 600n;

  // Setup block: deploy both wallets, fund the user wallet with real NVDAc taken from the pool.
  // The pool's code is blanked for this block only so it can act as a plain sender; it is restored next block.
  const poolCode = await client.getCode({ address: stock.pool.address });
  const setupBlock = {
    stateOverrides: {
      [stock.pool.address]: { code: '0x' },
      [spenderOwner]: { balance: numberToHex(10n ** 18n) },
      [userOwner.address]: { balance: numberToHex(10n ** 18n) },
    },
    calls: [
      call(anyone, ADDRESSES.SMART_WALLET_FACTORY, factoryAbi, 'createAccount', [userOwners, 0n]),
      ...(spenderAddress ? [] : [call(anyone, ADDRESSES.SMART_WALLET_FACTORY, factoryAbi, 'createAccount', [spenderOwners, 0n])]),
      call(stock.pool.address, stock.address, erc20Abi, 'transfer', [userWallet, funded]),
    ],
  };
  const restore = { stateOverrides: { [stock.pool.address]: { code: poolCode } } };

  const approveCall = { target: SPM, value: 0n, data: encodeFunctionData({ abi: spendPermissionManagerAbi, functionName: 'approveWithSignature', args: [permission, signature] }) };
  const spendCall = (v) => ({ target: SPM, value: 0n, data: encodeFunctionData({ abi: spendPermissionManagerAbi, functionName: 'spend', args: [permission, v] }) });
  const approveRouter = { target: stock.address, value: 0n, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [ADDRESSES.AERO_CL_SWAP_ROUTER, amount] }) };
  const swap = (min) => ({
    target: ADDRESSES.AERO_CL_SWAP_ROUTER, value: 0n,
    data: encodeFunctionData({
      abi: routerAbi, functionName: 'exactInputSingle',
      args: [{ tokenIn: stock.address, tokenOut: ADDRESSES.USDC, tickSpacing: stock.pool.tickSpacing, recipient: agentWallet, deadline, amountIn: amount, amountOutMinimum: min, sqrtPriceLimitX96: 0n }],
    }),
  });
  const batch = (calls) => call(spenderOwner, spender, smartWalletAbi, 'executeBatch', [calls]);
  const reads = [
    call(anyone, ADDRESSES.USDC, erc20Abi, 'balanceOf', [agentWallet]),
    call(anyone, stock.address, erc20Abi, 'balanceOf', [userWallet]),
    call(anyone, stock.address, erc20Abi, 'balanceOf', [spender]),
    call(anyone, ADDRESSES.USDC, erc20Abi, 'balanceOf', [spender]),
  ];
  const readBalances = (calls) => ({
    agentUsdc: decodeUint(erc20Abi, 'balanceOf', calls[0]),
    userNvdac: decodeUint(erc20Abi, 'balanceOf', calls[1]),
    spenderNvdac: decodeUint(erc20Abi, 'balanceOf', calls[2]),
    spenderUsdc: decodeUint(erc20Abi, 'balanceOf', calls[3]),
  });
  const callInfo = (c) => ({ status: c.status === '0x1' ? 'success' : 'reverted', gasUsed: BigInt(c.gasUsed), error: c.error?.message ?? null });

  const scenarios = {};

  // happy path
  {
    const r = await simulate(client, [setupBlock, { ...restore, calls: [batch([approveCall, spendCall(amount), approveRouter, swap(minOut)]), ...reads] }]);
    const setupOk = r[0].calls.every((c) => c.status === '0x1');
    const b = r[1].calls;
    const bal = readBalances(b.slice(1));
    scenarios.happy = {
      setupOk,
      batch: callInfo(b[0]),
      balances: bal,
      pass:
        setupOk && b[0].status === '0x1' && bal.agentUsdc >= minOut && bal.userNvdac === funded - amount &&
        bal.spenderNvdac === 0n && bal.spenderUsdc === 0n,
    };
  }

  // min-out above the quote → atomic revert
  {
    const r = await simulate(client, [setupBlock, { ...restore, calls: [batch([approveCall, spendCall(amount), approveRouter, swap(quotedOut * 2n)]), ...reads] }]);
    const b = r[1].calls;
    const bal = readBalances(b.slice(1));
    scenarios.minOutTooHigh = { batch: callInfo(b[0]), balances: bal, pass: b[0].status !== '0x1' && bal.userNvdac === funded && bal.agentUsdc === 0n };
  }

  // user revokes → spend fails
  {
    const revokeData = encodeFunctionData({ abi: spendPermissionManagerAbi, functionName: 'revoke', args: [permission] });
    const r = await simulate(client, [
      setupBlock,
      { ...restore, calls: [batch([approveCall])] },
      { calls: [call(userOwner.address, userWallet, smartWalletAbi, 'execute', [SPM, 0n, revokeData])] },
      { calls: [batch([spendCall(amount), approveRouter, swap(minOut)]), ...reads] },
    ]);
    const approveOk = r[1].calls[0].status === '0x1';
    const revokeOk = r[2].calls[0].status === '0x1';
    const b = r[3].calls;
    const bal = readBalances(b.slice(1));
    scenarios.revoked = { approveOk, revokeOk, batch: callInfo(b[0]), balances: bal, pass: approveOk && revokeOk && b[0].status !== '0x1' && bal.userNvdac === funded };
  }

  // spend more than the allowance → fails
  {
    const r = await simulate(client, [setupBlock, { ...restore, calls: [batch([approveCall, spendCall(allowance + 1n)]), ...reads] }]);
    const b = r[1].calls;
    const bal = readBalances(b.slice(1));
    scenarios.overAllowance = { batch: callInfo(b[0]), balances: bal, pass: b[0].status !== '0x1' && bal.userNvdac === funded };
  }

  // someone else tries to use the permission → fails
  {
    const r = await simulate(client, [
      setupBlock,
      { ...restore, calls: [batch([approveCall])] },
      { calls: [call(intruder, SPM, spendPermissionManagerAbi, 'spend', [permission, amount]), ...reads] },
    ]);
    const b = r[2].calls;
    const bal = readBalances(b.slice(1));
    scenarios.wrongSpender = { call: callInfo(b[0]), balances: bal, pass: r[1].calls[0].status === '0x1' && b[0].status !== '0x1' && bal.userNvdac === funded };
  }

  return {
    method: 'eth_simulateV1 on Base mainnet state (nothing broadcast)',
    blockNumber: block.number,
    blockTime: new Date(Number(now) * 1000).toISOString(),
    actors: { userWallet: getAddress(userWallet), spender: getAddress(spender), agentWallet, spenderIsCdp: Boolean(spenderAddress) },
    permission: { token: stock.address, allowance, period: permission.period, hash: permissionHash },
    amounts: { funded, amount, quotedOut, minOut },
    scenarios,
    pass: Object.values(scenarios).every((s) => s.pass),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSpendBatchSim()
    .then((r) => {
      console.log(toJson(r));
      if (!r.pass) process.exitCode = 1;
    })
    .catch((e) => {
      console.error('spend-batch-sim failed:', e.message);
      process.exitCode = 1;
    });
}
