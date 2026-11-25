# Holdtil

**Your agent's money stays invested until it pays.**

Holdtil lets AI agent owners keep their agent's money in tokenized stocks on Base (like NVDAc) and pay the agent's x402 bills from it — selling only at fair prices, only within the owner's limits.

[Live](#) · [Proof page](#) · [Demo video](#) · Status: in development (started 2026-11-24)

## The problem
Agents on Base now pay for their own data and tools with x402. Between payments, their money sits idle in USDC. Selling stock "whenever the agent needs cash" is risky: tokenized stocks trade 24/7, so a sale during an earnings spike or a weekend gap can happen far from the real price.

## What it does
`FUND WITH STOCK → AGENT PAYS → FLOAT RUNS LOW → FAIR-PRICE REFILL → PRICE OFF? WAIT → OWNER STOPS IT ANYTIME`

- Keeps a small USDC float in your agent's wallet and refills it from your stocks in batches.
- Sells only when the price is fresh and close to the real reference price. Otherwise it waits.
- Hard limits through Base Spend Permissions; one tap to stop; revoke any time.
- Receipts for every sale, with BaseScan links.
- Zero integration: your agent just needs its own wallet.

## Judge path, 60 seconds
1. Open `/proof`: Holdtil Scout, our own agent, pays x402stock.xyz for market data on Base mainnet. Every payment and refill links to BaseScan.
2. Open the first real refill: [0x576245f2…](https://basescan.org/tx/0x576245f2149007aeafc3fdc32efd2982d6fd24ae1cca4e4e72b470d75aa58655). One user op pulls 0.00665098 NVDAc through the owner's Spend Permission, swaps it on Aerodrome with a min-out, and sends 0.988785 USDC to the agent.
3. Open Scout's first x402 payment: [0x57a8130e…](https://basescan.org/tx/0x57a8130e63de6c5ddd17daa51af113819cc8a2524f9455d4a8e912ef660cf3db) (0.03 USDC).
4. Read `/docs` for how any agent connects with zero code.
5. Run `npm run verify` for the tests that block every "break it" case (stale price, wide gap, over limit, revoked permission, wrong destination, double refill, paused).

Live URL: added after deploy.

## What's real
Everything in the product runs on Base mainnet. See [REAL_VS_MOCKED.md](REAL_VS_MOCKED.md).

## How it uses Base
| Base tool | Job it does | Where |
|---|---|---|
| Coinbase tokenized stocks (B20, NVDAc) | The asset that gets sold for refills | `server/src/config/addresses.js` |
| Base Account + Sign in with Base | Login and permission signing | `client/src/wallet.js`, `server/src/routes/auth.js` |
| Spend Permissions | Hard daily limit the user signs and can revoke | `server/src/chain/spendPermission.js` |
| Chainlink tokenized equity feed | Reference price for the fair-price guard (24/5: weekends wait) | `server/src/chain/priceFeed.js` |
| Aerodrome Slipstream | NVDAc → USDC swap with min-out and deadline | `server/src/chain/quote.js`, `server/src/chain/refillBatch.js` |
| CDP smart account | Sends each refill as one user op; holds gas only | `server/src/chain/spender.js` |
| x402 (v2, `exact`) | How agents pay; Scout pays x402stock.xyz | `scout/src/` |

## Safety
Holdtil never holds your funds or keys. It can only use the Spend Permission you sign, up to its limit, and only to send USDC to your own agent's wallet.

**Not for US persons. Not financial advice. Stocks can go down.**

## Run it locally
Needs Node 22+ and a MongoDB (a free Atlas dev cluster is fine; never the prod one). Copy `server/.env.example` to `server/.env` and fill in your own values (never commit them). `npm run dev` reads `server/.env`.

```bash
npm install
npm run dev        # API on :3001, app on :5173
npm run verify     # lint + tests + build
npm run test:fork  # checks against real Base mainnet state (simulation only, sends nothing)
npm run tick       # one refill tick (dry unless EXECUTOR_MODE=live)
npm run scout      # one Holdtil Scout run (dry unless SCOUT_MODE=live)
```

## Known limits
- One stock for now (NVDAc). The NVDAc/USDC pool is small, so refills are small.
- Refills are live only for the owner's account with a $1 cap until the security review is done; other accounts run as dry runs.
- Weekends and market holidays: the reference price goes stale, so refills wait.
- The API runs on Render's free tier; a timer keeps it awake.

## Roadmap
See [ROADMAP.md](ROADMAP.md).
