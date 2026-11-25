// Holdtil spender helper. Prints PUBLIC addresses and balances only; never prints keys.
// Reads CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET, BASE_RPC_URL from the env file the npm script loads.
//
//   npm run spender -- info                 create (first time) or load the spender; print its address and ETH
//   npm run spender -- sweep                dry run: show how much ETH would go to SWEEP_TO
//   npm run spender -- sweep --send         send the spender's ETH (minus a small gas reserve) to SWEEP_TO
//
// Use `npm run spender:prod -- ...` to read server/.env.prod instead of server/.env.
// Stop the tick (EXECUTOR_MODE empty, cron job paused) before sweeping: refills need this ETH for gas.
import { pathToFileURL } from 'node:url';
import { CdpClient } from '@coinbase/cdp-sdk';
import { createPublicClient, http, formatEther, getAddress, isAddress, zeroAddress } from 'viem';
import { base } from 'viem/chains';
import { missingEnv } from '../src/config/env.js';

const GAS_RESERVE_UNITS = 300_000n; // generous gas for one ETH transfer as a user operation

export async function main(argv = process.argv.slice(2), env = process.env) {
  const [cmd = 'info'] = argv;
  const missing = missingEnv(['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET', 'CDP_WALLET_SECRET', 'BASE_RPC_URL'], env);
  if (missing.length) throw new Error(`missing env vars: ${missing.join(', ')}`);
  const client = createPublicClient({ chain: base, transport: http(env.BASE_RPC_URL) });
  const cdp = new CdpClient();
  const owner = await cdp.evm.getOrCreateAccount({ name: 'holdtil-spender-owner' });
  const smartAccount = await cdp.evm.getOrCreateSmartAccount({ name: 'holdtil-spender', owner });
  const balance = await client.getBalance({ address: smartAccount.address });
  const out = { spender: getAddress(smartAccount.address), ethBalance: formatEther(balance) };
  if (cmd === 'info') return out;
  if (cmd !== 'sweep') throw new Error(`unknown command ${cmd}`);

  const to = env.SWEEP_TO ?? '';
  if (!isAddress(to, { strict: false }) || getAddress(to) === zeroAddress) throw new Error('set SWEEP_TO to the address that should receive the ETH');
  if (env.SPENDER_ADDRESS && getAddress(env.SPENDER_ADDRESS) !== out.spender) throw new Error('this CDP spender does not match SPENDER_ADDRESS; refusing');
  const { maxFeePerGas } = await client.estimateFeesPerGas();
  const reserve = maxFeePerGas * GAS_RESERVE_UNITS;
  const amount = balance > reserve ? balance - reserve : 0n;
  const plan = { ...out, to: getAddress(to), send: formatEther(amount), keepForGas: formatEther(balance - amount) };
  if (amount === 0n) return { ...plan, status: 'nothing_to_send' };
  if (!argv.includes('--send')) return { ...plan, status: 'dry_run', next: 'add --send to send it' };
  const res = await cdp.evm.sendUserOperation({ smartAccount, network: 'base', calls: [{ to: getAddress(to), value: amount, data: '0x' }] });
  const done = await cdp.evm.waitForUserOperation({ smartAccountAddress: smartAccount.address, userOpHash: res.userOpHash });
  return { ...plan, status: done.status, userOpHash: res.userOpHash, txHash: done.transactionHash ?? null };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error('spender:', e.message);
      process.exitCode = 1;
    });
}
