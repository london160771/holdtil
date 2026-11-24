# Real vs. mocked — Holdtil

Stated plainly. The UI banner always shows **`REAL · BASE MAINNET`**. There is no demo mode in the product.

| Part | Real or mocked | Proof |
|---|---|---|
| Sign in with Base | Real (planned) | [ ] |
| Spend Permissions | Real, Base mainnet (planned) | [ ] |
| Refills (stock → USDC → agent wallet) | Real, Base mainnet (planned) | [tx hashes] |
| Receipts and decisions | Real, from DB + chain (planned) | [ ] |
| Holdtil Scout x402 payments | Real, Base mainnet (planned) | [tx hashes] |
| Fork tests | Local Base mainnet fork with fake money | test output; never shown as product data |

**Fallbacks:** none. If a value can't be read, the UI shows "unavailable".

**Not built yet:** everything — project started 2026-11-24. This file is updated as each part goes live.

This file, the UI banner, PRD §17 and the code agree. An honest "not yet" beats a fake green badge.
