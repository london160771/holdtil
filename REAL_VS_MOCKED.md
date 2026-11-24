# Real vs. mocked — Holdtil

Stated plainly. The UI banner always shows **`REAL · BASE MAINNET`**. There is no demo mode in the product.

| Part | Real or mocked | Proof |
|---|---|---|
| Sign in with Base | Real (planned) | [ ] |
| Spend Permissions | Real, Base mainnet (planned) | [ ] |
| Refills (stock → USDC → agent wallet) | Real, Base mainnet (planned) | [tx hashes] |
| Receipts and decisions | Real, from DB + chain (planned) | [ ] |
| Holdtil Scout x402 payments | Real, Base mainnet (planned) | [tx hashes] |
| Fork tests | Simulations on real Base mainnet state (`eth_simulateV1`), throwaway wallets, nothing broadcast | test output; never shown as product data |
| Gate 0 checks (2026-11-24) | Real mainnet reads + simulations + x402 dry run from an empty wallet; no transaction sent | `docs/gate0/2026-11-24-gate0-report.json` |

**Fallbacks:** none. If a value can't be read, the UI shows "unavailable".

**Not built yet:** every product feature — project started 2026-11-24. Phase 0 built the repo and proved Gate 0. This file is updated as each part goes live.

This file, the UI banner, PRD §17 and the code agree. An honest "not yet" beats a fake green badge.
