// Gate 0 "fork" tests: real Base mainnet state via read calls and eth_simulateV1. Nothing is broadcast.
// Anvil cannot run B20 precompiles (PRD §16), so these replace Anvil fork tests for B20 flows.
import { describe, it, expect } from 'vitest';
import { readPriceAndQuote } from '../../scripts/gate0/price-and-quote.js';
import { runSpendBatchSim } from '../../scripts/gate0/spend-batch-sim.js';

describe('Gate 0 on Base mainnet state', () => {
  it('#3 reads the NVDA Chainlink reference with its timestamp; #4 gets a DEX quote', async () => {
    const r = await readPriceAndQuote();
    expect(r.token.decimals).toBe(8);
    expect(r.usdcDecimals).toBe(6);
    expect(r.feed.description).toBe('Coinbase NVDA');
    expect(r.feed.answer).toBeGreaterThan(0n);
    expect(r.feed.ageSec).toBeGreaterThanOrEqual(0n);
    expect(r.quote.usdcOut).toBeGreaterThan(0n);
    expect(r.quote.gapBps).toBeTypeOf('bigint');
  });

  it('#1 + #2 spend permission on NVDAc and atomic pull → swap(min-out) → agent wallet', async () => {
    const r = await runSpendBatchSim();
    expect(r.scenarios.happy.pass).toBe(true);
    expect(r.scenarios.minOutTooHigh.pass).toBe(true);
    expect(r.scenarios.revoked.pass).toBe(true);
    expect(r.scenarios.overAllowance.pass).toBe(true);
    expect(r.scenarios.wrongSpender.pass).toBe(true);
  });
});
