// Live chain adapter for the executor (server/src/executor/tick.js). Reads with viem; simulates with
// eth_simulateV1 on real Base state; sends ONLY through the CDP spender (chain/spender.js).
import { createHash } from 'node:crypto';
import { encodeFunctionData, decodeFunctionResult, getAddress, numberToHex, parseEventLogs, parseAbi, toEventSelector } from 'viem';
import { ADDRESSES, isAllowlisted } from '../config/addresses.js';
import { erc20Abi, factoryAbi, smartWalletAbi, spendPermissionManagerAbi } from './abis.js';
import { readReference } from './priceFeed.js';
import { readBalance, readDecimals } from './balances.js';
import { quoteSell } from './quote.js';
import { readPermissionStatus } from './spendPermission.js';
import { loadSpender } from './spender.js';
import { withSuffix } from './builderCode.js';

const transferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const userOpEventAbi = parseAbi([
  'event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)',
]);

const USER_OP_EVENT_TOPIC = toEventSelector(userOpEventAbi[0]).toLowerCase();

/** CDP wants a UUID v4 idempotency key. Deterministic from the refill id, so a retry reuses it. */
export function idempotencyUuid(refillId) {
  const h = createHash('sha256').update(`holdtil-refill:${refillId}`).digest();
  h[6] = (h[6] & 0x0f) | 0x40;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

/**
 * Reads our own user op's result from a bundle receipt: its success flag and the USDC the pool paid the agent.
 * Only pool → agent transfers count, so other user ops in the same bundle can't be mistaken for ours.
 */
export function readUserOpResult(logs, { userOpHash, agentWallet, pool, spender, feeWallet }) {
  const ev = parseEventLogs({ abi: userOpEventAbi, logs, eventName: 'UserOperationEvent' }).find(
    (l) => l.args.userOpHash.toLowerCase() === userOpHash.toLowerCase(),
  );
  if (!ev) return { found: false };
  if (spender && getAddress(ev.args.sender) !== getAddress(spender)) return { found: false };
  // Only logs from our own op count: in a bundle, each op's logs sit between the previous op's
  // UserOperationEvent and its own (review 2026-11-26 #4: two refills in one bundle).
  const isOpEvent = (l) => l.topics?.[0]?.toLowerCase() === USER_OP_EVENT_TOPIC;
  const end = logs.findIndex((l) => isOpEvent(l) && l.topics?.[1]?.toLowerCase() === userOpHash.toLowerCase());
  let begin = end - 1;
  while (begin >= 0 && !isOpEvent(logs[begin])) begin -= 1;
  const ours = end >= 0 ? logs.slice(begin + 1, end) : [];
  const transfers = parseEventLogs({ abi: transferAbi, logs: ours, eventName: 'Transfer' });
  const paidTo = (who) =>
    transfers
      .filter((l) => getAddress(l.address) === getAddress(ADDRESSES.USDC) && getAddress(l.args.from) === getAddress(pool) && getAddress(l.args.to) === getAddress(who))
      .reduce((sum, l) => sum + l.args.value, 0n);
  return { found: true, success: ev.args.success, usdcOut: paidTo(agentWallet), feeOut: feeWallet ? paidTo(feeWallet) : 0n };
}
const ANYONE = '0x000000000000000000000000000000000000dEaD';

/**
 * Simulates the spender's executeBatch on real Base state. Deploys the spender in the simulation if it
 * has no code yet (CDP deploys it on the first real user operation). Returns the USDC the agent gains
 * (usdcOut) and, when a fee wallet is given, the USDC the fee wallet gains (feeOut).
 */
export async function simulateSpenderBatch(client, { spender, calls, agentWallet, feeWallet, dataSuffix, preBlocks = [], overrides = {} }) {
  // preBlocks / overrides: test-only setup (e.g. funding a throwaway user wallet). Empty in production.
  const code = await client.getCode({ address: spender.address });
  const deployed = Boolean(code && code !== '0x');
  const balanceOf = (who) => ({ from: ANYONE, to: ADDRESSES.USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [who] }) });
  const reads = feeWallet ? [balanceOf(agentWallet), balanceOf(feeWallet)] : [balanceOf(agentWallet)];
  const batch = {
    from: spender.ownerAddress,
    to: spender.address,
    // Same calldata the user op will carry, builder-code suffix included, so the simulation matches the send.
    data: withSuffix(encodeFunctionData({ abi: smartWalletAbi, functionName: 'executeBatch', args: [calls.map((c) => ({ target: c.to, value: c.value, data: c.data }))] }), dataSuffix),
  };
  const setup = deployed ? [] : [{ from: ANYONE, to: ADDRESSES.SMART_WALLET_FACTORY, data: encodeFunctionData({ abi: factoryAbi, functionName: 'createAccount', args: [spender.ownersBytes, 0n] }) }];
  const r = await client.request({
    method: 'eth_simulateV1',
    params: [{ blockStateCalls: [...preBlocks, { stateOverrides: { ...overrides, [spender.ownerAddress]: { balance: numberToHex(10n ** 17n) } }, calls: [...setup, ...reads, batch, ...reads] }], validation: false }, 'latest'],
  });
  const out = r[r.length - 1].calls;
  const n = setup.length;
  if (setup.length && out[0].status !== '0x1') return { ok: false, error: 'spender deploy failed in simulation' };
  const k = reads.length;
  const bal = (i) => decodeFunctionResult({ abi: erc20Abi, functionName: 'balanceOf', data: out[i].returnData });
  const b = out[n + k];
  if (b.status !== '0x1') return { ok: false, error: `batch reverted: ${b.error?.message ?? 'unknown'}` };
  const res = { ok: true, usdcOut: bal(n + k + 1) - bal(n), gasUsed: BigInt(b.gasUsed) };
  if (feeWallet) res.feeOut = bal(n + k + 2) - bal(n + 1);
  return res;
}

export function executorChain(client, { spenderAddress, dataSuffix, loadSpenderFn = loadSpender }) {
  return {
    blockTime: async () => (await client.getBlock()).timestamp,
    readUsdcBalance: (addr) => readBalance(client, ADDRESSES.USDC, addr),
    readDecimals: (token) => readDecimals(client, token),
    readReference: (stock) => readReference(client, stock),
    quoteSell: (stock, amount) => quoteSell(client, stock, amount),
    readPermissionStatus: (p, nowSec) => readPermissionStatus(client, p, nowSec),
    isApproved: (p) => client.readContract({ address: ADDRESSES.SPEND_PERMISSION_MANAGER, abi: spendPermissionManagerAbi, functionName: 'isApproved', args: [p] }),
    simulateRefill: async ({ calls, agentWallet, feeWallet }) => simulateSpenderBatch(client, { spender: await loadSpenderFn(spenderAddress), calls, agentWallet, feeWallet, dataSuffix }),
    sendRefill: async ({ calls, idempotencyKey }) => {
      const s = await loadSpenderFn(spenderAddress);
      const op = { smartAccount: s.smartAccount, network: 'base', calls, idempotencyKey: idempotencyUuid(idempotencyKey) };
      if (dataSuffix) op.dataSuffix = dataSuffix; // Base Builder Code (ERC-8021), attribution only
      const res = await s.cdp.evm.sendUserOperation(op);
      return { userOpHash: res.userOpHash };
    },
    checkRefill: async ({ userOpHash, agentWallet, pool, feeWallet, timeoutSec }) => {
      if (!isAllowlisted(pool)) throw new Error('checkRefill needs an allowlisted pool');
      const s = await loadSpenderFn(spenderAddress);
      let res;
      try {
        res = await s.cdp.evm.waitForUserOperation({ smartAccountAddress: s.address, userOpHash, waitOptions: { timeoutSeconds: timeoutSec, intervalSeconds: 1 } });
      } catch (e) {
        if (e?.name === 'TimeoutError') return { status: 'pending' };
        throw e;
      }
      if (res.status === 'failed') return { status: 'failed', error: 'user operation failed' };
      const receipt = await client.getTransactionReceipt({ hash: res.transactionHash });
      const op = readUserOpResult(receipt.logs, { userOpHash, agentWallet, pool, spender: s.address, feeWallet });
      if (!op.found) return { status: 'unknown', txHash: res.transactionHash }; // stays locked
      if (!op.success) return { status: 'failed', txHash: res.transactionHash, error: 'user operation reverted (nothing sold)' };
      return { status: 'complete', txHash: res.transactionHash, usdcOut: op.usdcOut, feeOut: op.feeOut };
    },
  };
}
