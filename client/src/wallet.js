// Base Account SDK: Sign in with Base and Spend Permission requests (PRD §15).
import { createBaseAccountSDK } from '@base-org/account';
import { requestSpendPermission, requestRevoke } from '@base-org/account/spend-permission';
import { getAddress, stringToHex } from 'viem';
import { createSiweMessage } from 'viem/siwe';
import { api } from './api.js';

const BASE_CHAIN_ID = 8453;
const BASE_CHAIN_HEX = '0x2105';
let sdk;

function provider() {
  if (!sdk) sdk = createBaseAccountSDK({ appName: 'Holdtil', appChainIds: [BASE_CHAIN_ID] });
  return sdk.getProvider();
}

/** Makes sure the Base Account provider is on Base (8453). Throws a clear error if the wallet stays elsewhere. */
async function ensureBase(p) {
  await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_HEX }] });
  const current = Number(await p.request({ method: 'eth_chainId' }));
  if (current !== BASE_CHAIN_ID) throw new Error(`Your wallet is on chain ${current}, not Base. Switch it to Base and try again.`);
}

// We build the sign-in message ourselves with chain 8453, so the wallet cannot pick another network.
// Always the Base Account SDK provider: never window.ethereum (Brave/MetaMask etc. are ignored).
export async function signInWithBase() {
  const p = provider();
  await ensureBase(p); // before connecting: sets the SDK's chain
  const accounts = await p.request({ method: 'eth_requestAccounts' });
  if (!accounts?.[0]) throw new Error('No account was shared by the wallet');
  const address = getAddress(accounts[0]);
  await ensureBase(p); // after connecting: switches a remembered session too
  const { nonce } = await api('/v1/auth/nonce');
  const now = new Date();
  const message = createSiweMessage({
    address,
    chainId: BASE_CHAIN_ID,
    domain: window.location.host,
    uri: window.location.origin,
    nonce,
    version: '1',
    statement: 'Sign in to Holdtil.',
    issuedAt: now,
    expirationTime: new Date(now.getTime() + 10 * 60 * 1000),
  });
  const signature = await p.request({ method: 'personal_sign', params: [stringToHex(message), address] });
  await api('/v1/auth/verify', { method: 'POST', body: { address, message, signature } });
  return address;
}

/** Asks the user's Base Account to sign a daily spend permission for Holdtil. Signing only — nothing is spent. */
export async function grantPermission({ account, spender, token, allowance }) {
  await ensureBase(provider());
  const signed = await requestSpendPermission({
    account,
    spender,
    token,
    chainId: BASE_CHAIN_ID,
    allowance: BigInt(allowance),
    periodInDays: 1,
    // The server accepts at most 366 days; the SDK default is 'forever'.
    end: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    provider: provider(),
  });
  return api('/v1/permissions', { method: 'POST', body: { permission: signed.permission, signature: signed.signature } });
}

/**
 * Revokes a spend permission on chain from the user's own Base Account (a wallet popup; the user pays gas).
 * After this the Spend Permission Manager refuses every spend, so Holdtil can't move any stock.
 */
export async function revokePermission(p) {
  await ensureBase(provider());
  const permission = {
    account: p.account, spender: p.spender, token: p.token, allowance: String(p.allowance),
    period: Number(p.period), start: Number(p.start), end: Number(p.end), salt: String(p.salt), extraData: p.extraData ?? '0x',
  };
  return requestRevoke({ provider: provider(), permission: { chainId: BASE_CHAIN_ID, signature: '0x', permission } });
}
