// Spend Permission reads and signature checks (PRD §15, FR-PRM-001/002). Read-only: nothing here sends a tx.
import { hashTypedData } from 'viem';
import { ADDRESSES, CHAIN_ID } from '../config/addresses.js';
import { spendPermissionManagerAbi } from './abis.js';

const SPM = ADDRESSES.SPEND_PERMISSION_MANAGER;

export function spendPermissionTypedData(permission) {
  return {
    domain: { name: 'Spend Permission Manager', version: '1', chainId: CHAIN_ID, verifyingContract: SPM },
    types: {
      SpendPermission: [
        { name: 'account', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'token', type: 'address' },
        { name: 'allowance', type: 'uint160' },
        { name: 'period', type: 'uint48' },
        { name: 'start', type: 'uint48' },
        { name: 'end', type: 'uint48' },
        { name: 'salt', type: 'uint256' },
        { name: 'extraData', type: 'bytes' },
      ],
    },
    primaryType: 'SpendPermission',
    message: permission,
  };
}

export const permissionHash = (p) => hashTypedData(spendPermissionTypedData(p));

/** Smart-wallet aware (ERC-1271 / ERC-6492) check that `account` signed the permission. */
export function verifyPermissionSignature(client, permission, signature) {
  return client.verifyTypedData({ address: permission.account, ...spendPermissionTypedData(permission), signature });
}

/**
 * Live status from the Spend Permission Manager.
 * status: active | revoked | expired | not_started. remaining = allowance − spent this period (token base units).
 */
export async function readPermissionStatus(client, permission, nowSec) {
  const revoked = await client.readContract({ address: SPM, abi: spendPermissionManagerAbi, functionName: 'isRevoked', args: [permission] });
  if (revoked) return { status: 'revoked', remaining: 0n, spentThisPeriod: null };
  if (nowSec >= BigInt(permission.end)) return { status: 'expired', remaining: 0n, spentThisPeriod: null };
  if (nowSec < BigInt(permission.start)) return { status: 'not_started', remaining: 0n, spentThisPeriod: null };
  const period = await client.readContract({ address: SPM, abi: spendPermissionManagerAbi, functionName: 'getCurrentPeriod', args: [permission] });
  const spent = period.spend;
  const remaining = permission.allowance > spent ? permission.allowance - spent : 0n;
  return { status: 'active', remaining, spentThisPeriod: spent, periodEnd: BigInt(period.end) };
}
