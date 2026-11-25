// One viem public client for Base mainnet. Read-only.
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { HoldtilError } from '../errors.js';

let cached;

export function getPublicClient(rpcUrl = process.env.BASE_RPC_URL) {
  if (!rpcUrl) throw new HoldtilError('internal_error', 'BASE_RPC_URL is not set', { status: 500 });
  if (!cached || cached.rpcUrl !== rpcUrl) {
    cached = { rpcUrl, client: createPublicClient({ chain: base, transport: http(rpcUrl, { retryCount: 2, timeout: 15_000 }) }) };
  }
  return cached.client;
}
