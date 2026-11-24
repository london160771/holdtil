// Creates (or loads) Holdtil's spender: a CDP Server Wallet smart account (Coinbase Smart Wallet v1.1)
// owned by a CDP-managed EOA. Prints PUBLIC addresses only. Sends no transaction.
// Needs CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET (read by the SDK from env; never printed).
import { CdpClient } from '@coinbase/cdp-sdk';
import { createPublicClient, http, encodeAbiParameters } from 'viem';
import { base } from 'viem/chains';
import { ADDRESSES } from '../../src/config/addresses.js';
import { missingEnv } from '../../src/config/env.js';

const FACTORY_ABI = [
  {
    type: 'function',
    name: 'getAddress',
    stateMutability: 'view',
    inputs: [{ name: 'owners', type: 'bytes[]' }, { name: 'nonce', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
];

export async function getSpender() {
  const missing = missingEnv(['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET', 'CDP_WALLET_SECRET', 'BASE_RPC_URL']);
  if (missing.length) throw new Error(`missing env vars: ${missing.join(', ')}`);
  const cdp = new CdpClient();
  const owner = await cdp.evm.getOrCreateAccount({ name: 'holdtil-spender-owner' });
  const smart = await cdp.evm.getOrCreateSmartAccount({ name: 'holdtil-spender', owner });

  // Check the CDP smart account is a Coinbase Smart Wallet v1.1 with this single owner, nonce 0.
  const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) });
  const expected = await client.readContract({
    address: ADDRESSES.SMART_WALLET_FACTORY,
    abi: FACTORY_ABI,
    functionName: 'getAddress',
    args: [[encodeAbiParameters([{ type: 'address' }], [owner.address])], 0n],
  });
  const code = await client.getCode({ address: smart.address });
  const ethBalance = await client.getBalance({ address: smart.address });
  return {
    ownerAddress: owner.address,
    smartAccountAddress: smart.address,
    factoryPredicted: expected,
    isCoinbaseSmartWalletV11: expected.toLowerCase() === smart.address.toLowerCase(),
    deployed: Boolean(code && code !== '0x'),
    ethBalanceWei: ethBalance.toString(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  getSpender()
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error('cdp-spender failed:', e.message);
      process.exitCode = 1;
    });
}
