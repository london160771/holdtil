// Shared helpers for Gate 0 scripts (PRD §16). Read-only or simulation-only: nothing here sends a transaction.
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { missingEnv } from '../../src/config/env.js';

export function publicClient() {
  const missing = missingEnv(['BASE_RPC_URL']);
  if (missing.length) throw new Error(`missing env vars: ${missing.join(', ')}`);
  return createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) });
}

export {
  erc20Abi,
  feedAbi,
  quoterAbi,
  routerAbi,
  spendPermissionManagerAbi,
  smartWalletAbi,
  factoryAbi,
} from '../../src/chain/abis.js';

/** |a − b| / b in basis points, rounded down. bigint only (INV-1). */
export function gapBps(quote, reference) {
  if (reference <= 0n) throw new Error('reference must be positive');
  const diff = quote > reference ? quote - reference : reference - quote;
  return (diff * 10_000n) / reference;
}

export function toJson(value) {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
}
