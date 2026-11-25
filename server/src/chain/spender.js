// Holdtil's spender: a CDP smart account (Coinbase Smart Wallet v1.1) owned by a CDP-managed key.
// Keys never leave CDP. CDP_API_KEY_ID / CDP_API_KEY_SECRET / CDP_WALLET_SECRET are read by the SDK from env.
// This is the ONLY module that can send a transaction. It refuses unless the CDP account matches SPENDER_ADDRESS.
import { encodeAbiParameters, getAddress } from 'viem';
import { HoldtilError } from '../errors.js';
import { missingEnv } from '../config/env.js';

let loaded;

export async function loadSpender(expectedAddress) {
  if (loaded) return loaded;
  const missing = missingEnv(['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET', 'CDP_WALLET_SECRET']);
  if (missing.length) throw new HoldtilError('internal_error', `spender not configured: missing ${missing.join(', ')}`, { status: 500 });
  const { CdpClient } = await import('@coinbase/cdp-sdk');
  const cdp = new CdpClient();
  const owner = await cdp.evm.getAccount({ name: 'holdtil-spender-owner' });
  const smartAccount = await cdp.evm.getSmartAccount({ name: 'holdtil-spender', owner });
  if (!expectedAddress || getAddress(smartAccount.address) !== getAddress(expectedAddress)) {
    throw new HoldtilError('internal_error', 'CDP spender does not match SPENDER_ADDRESS; refusing to use it', { status: 500 });
  }
  loaded = {
    cdp,
    smartAccount,
    ownerAddress: getAddress(owner.address),
    address: getAddress(smartAccount.address),
    ownersBytes: [encodeAbiParameters([{ type: 'address' }], [owner.address])],
  };
  return loaded;
}
