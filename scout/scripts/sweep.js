// Moves all of Scout's USDC to SWEEP_TO. Dry run unless --send. Never prints the key.
//   npm run scout:sweep            dry run: shows Scout's USDC and ETH and what would be sent
//   npm run scout:sweep -- --send  sends it (Scout pays the gas, so it needs a little ETH on Base first)
import { pathToFileURL } from 'node:url';
import { createPublicClient, createWalletClient, http, parseAbi, formatUnits, formatEther, getAddress, isAddress, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { USDC } from '../src/scout.js';

const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)']);

export async function main(argv = process.argv.slice(2), env = process.env) {
  if (!env.SCOUT_PRIVATE_KEY) throw new Error('missing env vars: SCOUT_PRIVATE_KEY');
  const to = env.SWEEP_TO ?? '';
  if (!isAddress(to, { strict: false }) || getAddress(to) === zeroAddress) throw new Error('set SWEEP_TO to the address that should receive the USDC');
  const account = privateKeyToAccount(env.SCOUT_PRIVATE_KEY);
  const transport = http(env.BASE_RPC_URL || 'https://mainnet.base.org');
  const client = createPublicClient({ chain: base, transport });
  const [usdc, eth] = await Promise.all([client.readContract({ address: USDC, abi: erc20, functionName: 'balanceOf', args: [account.address] }), client.getBalance({ address: account.address })]);
  const plan = { scout: account.address, to: getAddress(to), usdc: formatUnits(usdc, 6), eth: formatEther(eth) };
  if (usdc === 0n) return { ...plan, status: 'nothing_to_send' };
  // Simulate first; if it fails (e.g. no ETH for gas), nothing is sent.
  const { request } = await client.simulateContract({ account, address: USDC, abi: erc20, functionName: 'transfer', args: [getAddress(to), usdc] }).catch((e) => {
    throw new Error(`simulation failed (${e.shortMessage ?? 'error'}). If Scout has no ETH, send it ~$0.01 of ETH on Base first.`);
  });
  if (!argv.includes('--send')) return { ...plan, status: 'dry_run', next: 'add --send to send it' };
  const wallet = createWalletClient({ account, chain: base, transport });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  return { ...plan, status: receipt.status, txHash: hash };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error('sweep:', e.message);
      process.exitCode = 1;
    });
}
