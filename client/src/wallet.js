// Base Account SDK: Sign in with Base and Spend Permission requests (PRD §15).
import { createBaseAccountSDK } from '@base-org/account';
import { requestSpendPermission } from '@base-org/account/spend-permission';
import { api } from './api.js';

const BASE_CHAIN_ID = 8453;
let sdk;

function provider() {
  if (!sdk) sdk = createBaseAccountSDK({ appName: 'Holdtil', appChainIds: [BASE_CHAIN_ID] });
  return sdk.getProvider();
}

export async function signInWithBase() {
  const { nonce } = await api('/v1/auth/nonce');
  const res = await provider().request({
    method: 'wallet_connect',
    params: [{ version: '1', capabilities: { signInWithEthereum: { nonce, chainId: `0x${BASE_CHAIN_ID.toString(16)}` } } }],
  });
  const account = res?.accounts?.[0];
  const siwe = account?.capabilities?.signInWithEthereum;
  if (!account?.address || !siwe?.message || !siwe?.signature) throw new Error('The wallet did not return a sign-in signature');
  await api('/v1/auth/verify', { method: 'POST', body: { address: account.address, message: siwe.message, signature: siwe.signature } });
  return account.address;
}

/** Asks the user's Base Account to sign a daily spend permission for Holdtil. Signing only — nothing is spent. */
export async function grantPermission({ account, spender, token, allowance }) {
  const signed = await requestSpendPermission({
    account,
    spender,
    token,
    chainId: BASE_CHAIN_ID,
    allowance: BigInt(allowance),
    periodInDays: 1,
    provider: provider(),
  });
  return api('/v1/permissions', { method: 'POST', body: { permission: signed.permission, signature: signed.signature } });
}
