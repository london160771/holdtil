# Holdtil

**Your agent's money stays invested until it pays.**

AI agents now pay for their own data and tools. Their money usually sits idle in cash. Holdtil lets you keep your agent's budget in stock instead (tokenized NVIDIA on Base). When the agent's cash runs low, Holdtil sells a small amount of stock and tops it up, **only at a fair price and only within the limits you set**. If the price looks wrong, it waits.

[Live app](#) (link after deploy) · [How it works](client/src/pages/Docs.jsx) (`/docs`) · [Live proof](#) (`/proof`) · Demo video (soon)

**Not for US persons. Not financial advice. Stocks can go down.**

---

## In plain words

Think of a prepaid card for your agent plus a savings account in stock. When the card runs low, Holdtil moves a little from savings to the card. Your stock stays in your own wallet until the moment it's needed. You can stop it with one tap.

```
FUND WITH STOCK → AGENT PAYS → FLOAT RUNS LOW → FAIR-PRICE REFILL → PRICE OFF? WAIT → OWNER STOPS IT ANYTIME
```

- **You keep control.** Holdtil never holds your money or keys. It can only use a daily Spend Permission you sign in your Base Account, and you can revoke it any time.
- **Fair price or no sale.** It compares the exchange price to Chainlink's reference price. Old price (like weekends) or a gap over 1% means it waits.
- **Money only goes to your agent.** The agent's wallet is fixed when you add it.
- **Every action has a receipt**, with a BaseScan link.
- **No code for your agent.** It just needs its own wallet on Base.

## Proof: real transactions on Base mainnet

Every row is a real transaction you can open. Numbers are read from the chain.

| Date (UTC) | What | Amounts | Transaction |
|---|---|---|---|
| 2026-11-25 11:22 | First refill: owner's NVDAc → USDC to an agent (one user op through the Spend Permission + Aerodrome) | 0.00665098 NVDAc → 0.988785 USDC (min-out 0.983841) | [0x576245f2…8655](https://basescan.org/tx/0x576245f2149007aeafc3fdc32efd2982d6fd24ae1cca4e4e72b470d75aa58655) |
| 2026-11-25 11:55 | Second refill: rest of that day's permission | 0.00334870 NVDAc → 0.494924 USDC | [0x062d974c…c815](https://basescan.org/tx/0x062d974c2c4c3ef32b5d86046ca08a426828f19f29bbc89eb3e0cd1506fbc815) |
| 2026-11-25 12:02 | Holdtil Scout (our agent) pays x402stock.xyz for market data over x402 | 0.03 USDC | [0x57a8130e…f3db](https://basescan.org/tx/0x57a8130e63de6c5ddd17daa51af113819cc8a2524f9455d4a8e912ef660cf3db) |

Scout's first payment was funded by a manual 0.10 USDC transfer because that day's permission was already used. Holdtil refills of Scout follow. The live list is on `/proof`. What's real and what isn't: [REAL_VS_MOCKED.md](REAL_VS_MOCKED.md).

## Judge path, 60 seconds
1. Open `/proof`: Scout's real x402 payments and the refills that fund them, each with a BaseScan link.
2. Open the first refill above. One user operation: `approveWithSignature` + `spend` (Spend Permission) → `approve` + `exactInputSingle` (Aerodrome) with a min-out, USDC straight to the agent.
3. Read `/docs`: the product in plain words, and how any agent connects with zero code.
4. Run `npm run verify`: tests block every "break it" case (stale price, wide gap, over limit, revoked permission, wrong destination, double refill, paused).

---

## For developers and judges

### Architecture
```
Browser (React, Vite)  ──/v1 (same origin, Vercel rewrite)──►  API (Node, Express) ── MongoDB Atlas
  Sign in with Base, sign Spend Permission                        │
                                                                   ├─ tick every 5 min (cron) → executor
User's Base Account (holds NVDAc) ◄── Spend Permission Manager ◄──┤   CDP smart account (spender, gas only)
Agent wallet ◄── USDC ── Aerodrome Slipstream NVDAc/USDC ◄────────┘   Chainlink NVDA feed (24/5 reference)
Holdtil Scout (GitHub Actions, hourly) ── x402 ──► x402stock.xyz
```

### How Base is used
| Base tool | Job | Code |
|---|---|---|
| Coinbase tokenized stocks (B20, NVDAc) | The asset sold for refills | `server/src/config/addresses.js` |
| Base Account + Sign in with Base | Login (SIWE, ERC-1271/6492 aware) and permission signing | `client/src/wallet.js`, `server/src/routes/auth.js` |
| Spend Permissions | Daily limit the user signs and can revoke | `server/src/chain/spendPermission.js` |
| Chainlink tokenized equity feed | Reference price for the fair-price guard | `server/src/chain/priceFeed.js` |
| Aerodrome Slipstream | NVDAc → USDC swap with min-out and deadline | `server/src/chain/quote.js`, `server/src/chain/refillBatch.js` |
| CDP smart account | Sends each refill as one ERC-4337 user op; holds gas only | `server/src/chain/spender.js` |
| x402 v2 (`exact`) | How agents pay; Scout pays x402stock.xyz | `scout/src/` |

### Safety guards (PRD §11)
- **INV-2 fair price:** reference fresh (≤ 1 h, 24/5 feed), exchange quote within 1% of it, min-out never below reference − 1%.
- **INV-3 limits:** per refill, per agent per day, per user per day, permission allowance; $1 cap per refill during rollout.
- **INV-4 one refill at a time:** a partial unique index per agent; idempotent refill ids; state `sent` is written before broadcasting.
- **INV-5 destination:** the USDC recipient comes only from the stored agent wallet; the batch builder refuses tokens, pools, the spender and the user.
- **INV-7 kill switches:** global pause, Stop all, agent pause and revoked permissions are re-read right before sending.
- **Fail closed:** any value that can't be read means no sale. Every sale is simulated first (`eth_simulateV1` on real Base state).
- Security review (Checkpoint C) fixes: rate limits, cross-site write check, no raw errors in stored notes, gas-drain stop after 2 failed txs a day. See `PROJECT_STATE.md` §10.

### Run it
Needs Node 22+ and MongoDB. Copy `server/.env.example` to `server/.env` and fill in your own values (never commit them).

```bash
npm install
npm run dev        # API on :3001, app on :5173
npm run verify     # lint + tests + build (the gate)
npm run test:fork  # real Base mainnet state via eth_simulateV1; sends nothing
npm run tick       # one refill tick (dry unless EXECUTOR_MODE=live)
npm run scout      # one Holdtil Scout run (dry unless SCOUT_MODE=live)
```

Repo map: `server/` API + executor, `client/` web app, `scout/` our x402 agent, `docs/` Gate 0 report and guides. Requirements: [PRD.md](PRD.md). Progress: [PROJECT_STATE.md](PROJECT_STATE.md).

### Known limits
- One stock for now (NVDAc). The NVDAc/USDC pool is small, so refills are small.
- Real refills are on for the owner's account only ($1 cap) until rollout step 5; other accounts run as dry runs.
- Weekends and market holidays: the reference price is stale, so refills wait.
- The API runs on Render's free tier; a timer keeps it and the database awake.

### Withdraw
Everything sits in wallets the owner controls. Steps: [docs/withdraw.md](docs/withdraw.md).

## Roadmap
See [ROADMAP.md](ROADMAP.md).
