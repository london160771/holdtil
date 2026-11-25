# Real vs. mocked — Holdtil

Stated plainly. The UI banner always shows **`REAL · BASE MAINNET`**. There is no demo mode in the product.

| Part | Real or mocked | Proof |
|---|---|---|
| Sign in with Base | Real code, Base mainnet; tested with throwaway keys and smart-wallet signatures; and with the owner's real Base Account (2026-11-25) | API + fork tests; owner check |
| Spend Permissions | Signing + live status read from chain built; signed by the owner's real Base Account (2026-11-25). Nothing is spent until Phase 3 | API + fork tests; owner check |
| Refills (stock → USDC → agent wallet) | Real, Base mainnet. Live for the owner's account only ($1 cap, rollout step 4); everyone else dry run | [first refill](https://basescan.org/tx/0x576245f2149007aeafc3fdc32efd2982d6fd24ae1cca4e4e72b470d75aa58655) |
| Base Builder Code on refills | Real code path, tested (unit + fork simulation). Off until the owner sets `BUILDER_CODE`; first tagged refill pending owner approval | tests; base.dev check after the first tagged refill |
| Fair-price check sold on Bankr (x402, $0.01) | Real code, tested with a fake chain and one live read on Base mainnet (real verdict). Not deployed yet: the owner deploys it to Bankr x402 Cloud; first paid call pending owner approval. /proof shows "Not live yet" until then | tests; `npm run test:fork` |
| Receipts and decisions | Real, from DB (`/v1/refills`, agent page) | API tests |
| Holdtil Scout x402 payments | Real, Base mainnet. Scout pays x402stock.xyz $0.03 per call from its own wallet. First payment funded by a manual 0.1 USDC transfer; Holdtil refills of Scout start 2026-11-26. Runs on the owner's PC until deploy | [first payment](https://basescan.org/tx/0x57a8130e63de6c5ddd17daa51af113819cc8a2524f9455d4a8e912ef660cf3db) |
| Fork tests | Simulations on real Base mainnet state (`eth_simulateV1`), throwaway wallets, nothing broadcast | test output; never shown as product data |
| Gate 0 checks (2026-11-24) | Real mainnet reads + simulations + x402 dry run from an empty wallet; no transaction sent | `docs/gate0/2026-11-24-gate0-report.json` |

**Fallbacks:** none. If a value can't be read, the UI shows "unavailable".

**Not live yet:** `/proof` runs locally until the owner deploys (Phase 5). Refills are live only for the owner's account with a $1 cap until launch (Phase 5). This file is updated as each part goes live.

This file, the UI banner, PRD §17 and the code agree. An honest "not yet" beats a fake green badge.
