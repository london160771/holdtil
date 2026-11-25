# Real vs. mocked — Holdtil

Stated plainly. The UI banner always shows **`REAL · BASE MAINNET`**. There is no demo mode in the product.

| Part | Real or mocked | Proof |
|---|---|---|
| Sign in with Base | Real code, Base mainnet; tested with throwaway keys and smart-wallet signatures; and with the owner's real Base Account (2026-11-25) | API + fork tests; owner check |
| Spend Permissions | Signing + live status read from chain built; signed by the owner's real Base Account (2026-11-25). Nothing is spent until Phase 3 | API + fork tests; owner check |
| Refills (stock → USDC → agent wallet) | Real, Base mainnet. Live for the owner's account only ($1 cap, rollout step 4); everyone else dry run | [first refill](https://basescan.org/tx/0x576245f2149007aeafc3fdc32efd2982d6fd24ae1cca4e4e72b470d75aa58655) |
| Receipts and decisions | Real, from DB (`/v1/refills`, agent page) | API tests |
| Holdtil Scout x402 payments | Real, Base mainnet (planned) | [tx hashes] |
| Fork tests | Simulations on real Base mainnet state (`eth_simulateV1`), throwaway wallets, nothing broadcast | test output; never shown as product data |
| Gate 0 checks (2026-11-24) | Real mainnet reads + simulations + x402 dry run from an empty wallet; no transaction sent | `docs/gate0/2026-11-24-gate0-report.json` |

**Fallbacks:** none. If a value can't be read, the UI shows "unavailable".

**Not built yet:** Scout, `/proof`. Refills are live only for the owner's account with a $1 cap until launch (Phase 5). This file is updated as each part goes live.

This file, the UI banner, PRD §17 and the code agree. An honest "not yet" beats a fake green badge.
