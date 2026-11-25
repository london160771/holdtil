# Real vs. mocked — Holdtil

Stated plainly. The UI banner always shows **`REAL · BASE MAINNET`**. There is no demo mode in the product.

| Part | Real or mocked | Proof |
|---|---|---|
| Sign in with Base | Real code, Base mainnet; tested with throwaway keys and smart-wallet signatures; and with the owner's real Base Account (2026-11-25) | API + fork tests; owner check |
| Spend Permissions | Signing + live status read from chain built; signed by the owner's real Base Account (2026-11-25). Nothing is spent until Phase 3 | API + fork tests; owner check |
| Refills (stock → USDC → agent wallet) | Executor built; dry run (simulation on real Base state) verified. No real refill sent yet | fork tests; tx hash after the owner-approved first refill |
| Receipts and decisions | Real, from DB (`/v1/refills`, agent page) | API tests |
| Holdtil Scout x402 payments | Real, Base mainnet (planned) | [tx hashes] |
| Fork tests | Simulations on real Base mainnet state (`eth_simulateV1`), throwaway wallets, nothing broadcast | test output; never shown as product data |
| Gate 0 checks (2026-11-24) | Real mainnet reads + simulations + x402 dry run from an empty wallet; no transaction sent | `docs/gate0/2026-11-24-gate0-report.json` |

**Fallbacks:** none. If a value can't be read, the UI shows "unavailable".

**Not built yet:** Scout, `/proof`. Phase 3 executor is built and runs in dry mode; the first real refill needs the owner's approval. This file is updated as each part goes live.

This file, the UI banner, PRD §17 and the code agree. An honest "not yet" beats a fake green badge.
