// Read-only adapters against real Base mainnet (needs BASE_RPC_URL). Sends nothing.
import { describe, it, expect } from 'vitest';
import { ADDRESSES, STOCKS } from '../../src/config/addresses.js';
import { getPublicClient } from '../../src/chain/client.js';
import { readReference } from '../../src/chain/priceFeed.js';
import { readBalance, readDecimals } from '../../src/chain/balances.js';
import { quoteSell } from '../../src/chain/quote.js';

const client = getPublicClient();
const stock = STOCKS.NVDAc;

describe('read-only chain adapters (Base mainnet)', () => {
  it('reads decimals on chain', async () => {
    expect(await readDecimals(client, stock.address)).toBe(8);
    expect(await readDecimals(client, ADDRESSES.USDC)).toBe(6);
  });

  it('reads the reference with its timestamp', async () => {
    const r = await readReference(client, stock);
    expect(r.decimals).toBe(8);
    expect(r.answer).toBeGreaterThan(0n);
    expect(r.updatedAt).toBeGreaterThan(0n);
  });

  it('reads pool balances as bigint', async () => {
    const n = await readBalance(client, stock.address, stock.pool.address);
    expect(typeof n).toBe('bigint');
    expect(n).toBeGreaterThan(0n);
  });

  it('quotes a small sale', async () => {
    const q = await quoteSell(client, stock, 1_000_000n);
    expect(q.amountOut).toBeGreaterThan(0n);
  });

  it('refuses tokens outside the allowlist', async () => {
    await expect(readBalance(client, '0x0000000000000000000000000000000000000001', stock.pool.address)).rejects.toMatchObject({ code: 'invalid_input' });
  });
});
