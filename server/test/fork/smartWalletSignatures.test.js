// Smart-wallet signatures against real Base mainnet (ERC-6492 for an undeployed Coinbase Smart Wallet).
// Proves the production verifiers (chainDeps) accept Base Account signatures. Sends nothing.
import { describe, it, expect } from 'vitest';
import { createSiweMessage } from 'viem/siwe';
import { toCoinbaseSmartAccount } from 'viem/account-abstraction';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { getPublicClient } from '../../src/chain/client.js';
import { chainDeps } from '../../src/app.js';
import { spendPermissionTypedData } from '../../src/chain/spendPermission.js';
import { STOCKS } from '../../src/config/addresses.js';

const client = getPublicClient();
const chain = chainDeps(client);

async function smartAccount() {
  const owner = privateKeyToAccount(generatePrivateKey());
  return toCoinbaseSmartAccount({ client, owners: [owner], version: '1.1' });
}

describe('smart wallet signatures (Base mainnet)', () => {
  it('SIWE from an undeployed Coinbase Smart Wallet verifies; a tampered one does not', async () => {
    const acct = await smartAccount();
    const message = createSiweMessage({ address: acct.address, chainId: 8453, domain: 'holdtil.xyz', nonce: 'abcdef1234567890', uri: 'https://holdtil.xyz', version: '1' });
    const signature = await acct.signMessage({ message });
    expect(await chain.verifySiwe({ address: acct.address, message, signature })).toBe(true);
    expect(await chain.verifySiwe({ address: acct.address, message: message + ' ', signature })).toBe(false);
  });

  it('a spend permission signed by the smart wallet verifies; another wallet does not', async () => {
    const acct = await smartAccount();
    const now = Math.floor(Date.now() / 1000);
    const p = { account: acct.address, spender: '0xb7F3c5F916359B303d3ecEbB39f47969444fd15B', token: STOCKS.NVDAc.address, allowance: 2_000_000n, period: 86400, start: now, end: now + 86400, salt: 1n, extraData: '0x' };
    const signature = await acct.signTypedData(spendPermissionTypedData(p));
    expect(await chain.verifyPermissionSignature(p, signature)).toBe(true);
    const other = await smartAccount();
    expect(await chain.verifyPermissionSignature({ ...p, account: other.address }, signature)).toBe(false);
  });

  it('the owner smart wallet (EIP-7702) reads as a live permission status', async () => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const p = { account: '0x406bd02d69f1f5d9850c330e7da8252b1a5f4c56', spender: '0xb7F3c5F916359B303d3ecEbB39f47969444fd15B', token: STOCKS.NVDAc.address, allowance: 1_000_000n, period: 86400, start: Number(now - 60n), end: Number(now + 86400n), salt: 123n, extraData: '0x' };
    const s = await chain.readPermissionStatus(p, now);
    expect(s).toMatchObject({ status: 'active', remaining: 1_000_000n, spentThisPeriod: 0n });
  });
});
