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
[Added when `/proof` is live.]

## What's real
Everything in the product runs on Base mainnet. See [REAL_VS_MOCKED.md](REAL_VS_MOCKED.md).

## How it uses Base
[Table from PRD §15, filled as parts go live.]

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
```

## Known limits
[Added as found.]

## Roadmap
See [ROADMAP.md](ROADMAP.md).
