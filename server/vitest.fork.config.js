import { defineConfig } from 'vitest/config';

// "Fork" tests run against real Base mainnet state through eth_simulateV1 (see PRD §16 for why not Anvil).
// They need BASE_RPC_URL and network access. They never send a transaction.
export default defineConfig({
  test: { include: ['test/fork/**/*.test.js'], testTimeout: 120_000, hookTimeout: 120_000 },
});
