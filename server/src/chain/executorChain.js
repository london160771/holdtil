// Live chain adapter for the executor (server/src/executor/tick.js). Reads with viem; simulates with
// eth_simulateV1 on real Base state; sends ONLY through the CDP spender (chain/spender.js).
import { encodeFunctionData, decodeFunctionResult, getAddress, numberToHex, parseEventLogs, parseAbi } from 'viem';
import { ADDRESSES } from '../config/addresses.js';
import { erc20Abi, factoryAbi, smartWalletAbi, spendPermissionManagerAbi } from './abis.js';
import { readReference } from './priceFeed.js';
import { readBalance } from './balances.js';
import { quoteSell } from './quote.js';
import { readPermissionStatus } from './spendPermission.js';
import { loadSpender } from './spender.js';

const transferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const ANYONE = '0x000000000000000000000000000000000000dEaD';

/** Sums USDC Transfer logs to `to` in a receipt. */
export function usdcReceived(logs, to) {
  const parsed = parseEventLogs({ abi: transferAbi, logs, eventName: 'Transfer' });
  return parsed
    .filter((l) => getAddress(l.address) === getAddress(ADDRESSES.USDC) && getAddress(l.args.to) === getAddress(to))
    .reduce((s, l) => s + l.args.value, 0n);
}

/**
 * Simulates the spender's executeBatch on real Base state. Deploys the spender in the simulation if it
 * has no code yet (CDP deploys it on the first real user operation). Returns the USDC the agent gains.
 */
export async function simulateSpenderBatch(client, { spender, calls, agentWallet, preBlocks = [], overrides = {} }) {
  // preBlocks / overrides: test-only setup (e.g. funding a throwaway user wallet). Empty in production.
  const code = await client.getCode({ address: spender.address });
  const deployed = Boolean(code && code !== '0x');
  const balanceCall = { from: ANYONE, to: ADDRESSES.USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [agentWallet] }) };
  const batch = {
    from: spender.ownerAddress,
    to: spender.address,
    data: encodeFunctionData({ abi: smartWalletAbi, functionName: 'executeBatch', args: [calls.map((c) => ({ target: c.to, value: c.value, data: c.data }))] }),
  };
  const setup = deployed ? [] : [{ from: ANYONE, to: ADDRESSES.SMART_WALLET_FACTORY, data: encodeFunctionData({ abi: factoryAbi, functionName: 'createAccount', args: [spender.ownersBytes, 0n] }) }];
  const r = await client.request({
    method: 'eth_simulateV1',
    params: [{ blockStateCalls: [...preBlocks, { stateOverrides: { ...overrides, [spender.ownerAddress]: { balance: numberToHex(10n ** 17n) } }, calls: [...setup, balanceCall, batch, balanceCall] }], validation: false }, 'latest'],
  });
  const out = r[r.length - 1].calls;
  const n = setup.length;
  if (setup.length && out[0].status !== '0x1') return { ok: false, error: 'spender deploy failed in simulation' };
  const before = decodeFunctionResult({ abi: erc20Abi, functionName: 'balanceOf', data: out[n].returnData });
  const b = out[n + 1];
  if (b.status !== '0x1') return { ok: false, error: `batch reverted: ${b.error?.message ?? 'unknown'}` };
  const after = decodeFunctionResult({ abi: erc20Abi, functionName: 'balanceOf', data: out[n + 2].returnData });
  return { ok: true, usdcOut: after - before, gasUsed: BigInt(b.gasUsed) };
}

export function executorChain(client, { spenderAddress }) {
  return {
    blockTime: async () => (await client.getBlock()).timestamp,
    readUsdcBalance: (addr) => readBalance(client, ADDRESSES.USDC, addr),
    readReference: (stock) => readReference(client, stock),
    quoteSell: (stock, amount) => quoteSell(client, stock, amount),
    readPermissionStatus: (p, nowSec) => readPermissionStatus(client, p, nowSec),
    isApproved: (p) => client.readContract({ address: ADDRESSES.SPEND_PERMISSION_MANAGER, abi: spendPermissionManagerAbi, functionName: 'isApproved', args: [p] }),
    simulateRefill: async ({ calls, agentWallet }) => simulateSpenderBatch(client, { spender: await loadSpender(spenderAddress), calls, agentWallet }),
    sendRefill: async ({ calls, idempotencyKey }) => {
      const s = await loadSpender(spenderAddress);
      const res = await s.cdp.evm.sendUserOperation({ smartAccount: s.smartAccount, network: 'base', calls, idempotencyKey });
      return { userOpHash: res.userOpHash };
    },
    checkRefill: async ({ userOpHash, agentWallet, timeoutSec }) => {
      const s = await loadSpender(spenderAddress);
      let res;
      try {
        res = await s.cdp.evm.waitForUserOperation({ smartAccountAddress: s.address, userOpHash, waitOptions: { timeoutSeconds: timeoutSec, intervalSeconds: 1 } });
      } catch (e) {
        if (e?.name === 'TimeoutError') return { status: 'pending' };
        throw e;
      }
      if (res.status === 'failed') return { status: 'failed', error: 'user operation failed' };
      const receipt = await client.getTransactionReceipt({ hash: res.transactionHash });
      if (receipt.status !== 'success') return { status: 'failed', txHash: res.transactionHash, error: 'transaction reverted' };
      return { status: 'complete', txHash: res.transactionHash, usdcOut: agentWallet ? usdcReceived(receipt.logs, agentWallet) : 0n };
    },
  };
}
