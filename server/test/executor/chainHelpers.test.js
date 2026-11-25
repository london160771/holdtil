import { describe, it, expect } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, parseAbi } from 'viem';
import { idempotencyUuid, readUserOpResult } from '../../src/chain/executorChain.js';
import { ADDRESSES, STOCKS } from '../../src/config/addresses.js';

const abi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)',
]);
const OP = `0x${'1'.repeat(64)}`;
const SPENDER = '0xb7F3c5F916359B303d3ecEbB39f47969444fd15B';
const AGENT = '0x1111111111111111111111111111111111111111';
const POOL = STOCKS.NVDAc.pool.address;
const log = (address, eventName, args, data) => ({
  address, topics: encodeEventTopics({ abi, eventName, args }), data, blockHash: null, blockNumber: null, logIndex: null, transactionHash: null, transactionIndex: null, removed: false,
});
const transfer = (from, to, v, token = ADDRESSES.USDC) => log(token, 'Transfer', { from, to }, encodeAbiParameters([{ type: 'uint256' }], [v]));
const opEvent = (hash, success, sender = SPENDER) =>
  log('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', 'UserOperationEvent', { userOpHash: hash, sender, paymaster: '0x0000000000000000000000000000000000000000' },
    encodeAbiParameters([{ type: 'uint256' }, { type: 'bool' }, { type: 'uint256' }, { type: 'uint256' }], [0n, success, 1n, 1n]));

describe('idempotencyUuid', () => {
  it('is a deterministic UUID v4', () => {
    const a = idempotencyUuid('abc');
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(idempotencyUuid('abc')).toBe(a);
    expect(idempotencyUuid('abd')).not.toBe(a);
  });
});

describe('readUserOpResult', () => {
  const opts = { userOpHash: OP, agentWallet: AGENT, pool: POOL, spender: SPENDER };
  it('counts only pool → agent USDC for our successful op', () => {
    const logs = [transfer(POOL, AGENT, 1_000_000n), transfer('0x2222222222222222222222222222222222222222', AGENT, 5_000_000n), transfer(POOL, AGENT, 7n, STOCKS.NVDAc.address), opEvent(OP, true)];
    expect(readUserOpResult(logs, opts)).toEqual({ found: true, success: true, usdcOut: 1_000_000n });
  });
  it('reports a reverted op', () => {
    expect(readUserOpResult([opEvent(OP, false)], opts)).toMatchObject({ found: true, success: false });
  });
  it('another op or another sender is not ours', () => {
    expect(readUserOpResult([opEvent(`0x${'2'.repeat(64)}`, true)], opts)).toEqual({ found: false });
    expect(readUserOpResult([opEvent(OP, true, AGENT)], opts)).toEqual({ found: false });
  });
});
