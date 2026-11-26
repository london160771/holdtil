# Holdtil

**Your agent's budget should be working, even when it's not spending.**

AI agents are starting to pay for their own data, tools, and APIs through small USDC payments using x402. But there's a catch: their owners have to keep USDC sitting in agent wallets, waiting to be spent.

Holdtil changes that.

Instead of leaving your agent's entire budget idle in USDC, you can keep it invested in tokenized stocks on Base (NVIDIA, Apple, Tesla, Meta, Alphabet or Microsoft), right in your own wallet.

When your agent needs funds, Holdtil converts only the amount required into USDC, at a fair price and within the limits you've approved.

If the price isn't right, it waits.

Your agent gets the liquidity it needs. Your capital gets the chance to keep working.

[Live app](#) (link after deploy) · [Docs](client/src/pages/Docs.jsx) (`/docs`) · [Live proof](#) (`/proof`) · Demo video (soon)

> **Not for US persons. Not financial advice. Stocks can go down.** Holdtil never holds your funds or your keys.

---

## Contents
1. [The problem it solves](#1-the-problem-it-solves)
2. [Who needs it](#2-who-needs-it)
3. [Where the money sits: stock balance vs USDC float](#3-where-the-money-sits-stock-balance-vs-usdc-float)
4. [Features](#4-features) · [Holdtil for Bankr agents](#holdtil-for-bankr-agents)
5. [First time here? A guide for new users](#5-first-time-here-a-guide-for-new-users)
6. [How to use it day to day](#6-how-to-use-it-day-to-day)
7. [Add your real agent](#7-add-your-real-agent)
8. [Accounts: one person, one wallet, their own agents](#8-accounts-one-person-one-wallet-their-own-agents)
9. [Security: what Holdtil can and cannot do](#9-security-what-holdtil-can-and-cannot-do)
10. [Security proof](#10-security-proof)
11. [Why Base](#11-why-base)
12. [Tech stack and architecture](#12-tech-stack-and-architecture)
13. [Run it locally](#13-run-it-locally)
14. [Known limits](#14-known-limits)

---

## 1. The problem it solves

**Agent money sits idle.** An agent that pays for data over x402 needs USDC in its wallet, so owners top it up with more than it needs "just in case". Most of that money does nothing for weeks.

**Selling stock "when needed" is risky.** Tokenized stocks trade on Base 24/7, but the real stock market does not. At night, at weekends and around earnings, the onchain price can drift far from the real one. A simple script that sells when the agent runs low can sell at a bad moment. On Nvidia's earnings night, the NVDAc pool moved from about $209.87 to $220.66 within hours while the real market was closed.

**Holdtil fixes both.** The budget stays in stock until the moment the agent needs cash. Every sale is checked against Chainlink's reference price first, and every sale stays inside limits the owner signed. Otherwise Holdtil waits and writes down why.

> Holdtil never sells a user's stock unless the price is fresh, fair and within the user's limits. Otherwise it waits.

## 2. Who needs it

| Who | What they get |
|---|---|
| **Builders running paying agents** (research bots, trading assistants, data pipelines) | The agent never runs dry, and its budget stays invested instead of sitting in cash |
| **Small teams with several agents** | Up to 5 agents per account, each with its own limits, one daily cap across all of them, one Stop button |
| **People who already hold tokenized stock on Base** | A safe way to fund agent spending from it, without selling everything up front |
| **Anyone who wants receipts** | Every refill and every "wait" is logged with the reason and a BaseScan link |

It is **not** a trading bot, a portfolio manager or a yield vault. Holdtil only decides how and when a little stock becomes the agent's spending money.

## 3. Where the money sits: stock balance vs USDC float

There are two balances, in two different wallets:

| | **Stock balance** | **USDC float** |
|---|---|---|
| What | A tokenized stock you pick per agent: NVDAc, AAPLc, TSLAc, METAc, GOOGLc or MSFTc | USDC (digital dollars) |
| Where | **Your** Base Account (your smart wallet) | **Your agent's** wallet |
| Who controls it | You. Holdtil can only use the daily Spend Permission you signed | The agent (it holds its own key) |
| Size | Most of the budget | Small: between the floor and the target you set |
| Moves with the stock price? | Yes, it can go up or down | No, 1 USDC ≈ $1 |

**So "the agent's budget stays invested" means:** the agent's *budget* is held as stock in your wallet. Only the small slice it is about to spend is USDC in the agent's wallet. The stock never sits in the agent's wallet, and Holdtil never holds it.

**A refill, with the default limits** (floor $1, target $3, max $2 per refill, $5 per agent per day, $10 per account per day):

1. The agent starts with **$3.00** USDC and pays **$0.03** per data call.
2. After 67 calls it has **$0.99**. That is below the **$1 floor**, so a refill is due.
3. Within 5 minutes Holdtil checks the price. Chainlink's reference must be less than 1 hour old, and the exchange price must be within 1% of it.
4. If both are fine, it takes a small amount of stock from your Base Account (through your Spend Permission), swaps it to USDC with a guaranteed minimum, and sends the USDC to the agent. In the same **one transaction** it also sells $0.02 of stock to pay back the gas (you pay your own gas; Holdtil sponsors nothing). The agent is back to about **$2.97**, because one refill, fee included, is capped at $2.
5. If the price is old (for example at night, at the weekend or on a US holiday) or off by more than 1%, it **waits** and tries again on the next check.

There is also a site-wide safety cap of **$25** per refill, whatever limits you set.

## 4. Features

**For you, the owner**
- **Fair-price guard.** Every sale needs a fresh Chainlink reference price (less than 1 hour old, from the 24/5 feed, so weekends always wait). The exchange quote must be within 1% of it, and the swap has a minimum USDC out that is never below reference − 1%.
- **Six stocks.** NVDAc, AAPLc, TSLAc, METAc, GOOGLc and MSFTc (Coinbase tokenized stocks). Each agent pays from the one you pick, each with its own Chainlink feed and Aerodrome pool.
- **Limits you set.** Floor, target, max per refill and a daily limit per agent, plus a daily limit for your whole account. Hard caps stop anyone from setting them too high, and a $25 site-wide cap applies to every refill.
- **Spend Permission, not custody.** You sign a daily allowance in your own Base Account, for example "Holdtil may use up to 0.01 NVDAc per day". You can revoke it any time, from the dashboard or from your wallet.
- **One destination.** USDC only ever goes to the agent wallet you registered. That address can't be changed later, and the transaction builder refuses any other recipient.
- **One refill at a time.** The database allows only one refill in flight per agent, so two checks at the same moment can never pay twice.
- **Kill switches.** **Stop all** (whole account), **Pause** (one agent), **Revoke** (the permission). Each is re-checked right before anything is sent.
- **Receipts for everything.** Every refill and every wait is printed on the agent page, with the reason, the price gap, the minimum out and a BaseScan link.
- **Zero code for your agent.** If it pays from its own wallet on Base, it already works. No SDK.
- **Several agents.** Up to 5 per account. If they share one allowance, the emptiest one is refilled first.
- **Market hours notice.** The app tells you when the US market is closed and when the next refill window is expected. It is display only: the price guard still decides every sale.
- **Earned while waiting.** The dashboard shows what your budget earned (or lost) by staying in stock instead of sitting in cash, from stored refills and live Chainlink prices.
- **Spending log.** Money in (refills) and money out (x402 payments) in one list, each with a BaseScan link.
- **You pay your own gas.** Each refill sells a small fixed fee ($0.02 by default, never more than $0.05) in the same transaction, to pay back the spender's gas. It counts toward your limits and shows on the receipt. The spender holds only a little ETH, never user money.
- **Live public proof.** `/proof` shows our own agent, Holdtil Scout, paying for real data and getting refilled on Base mainnet.

**For other agents and builders**
- **Fair-price check, sold over x402 on Bankr.** Any agent can pay $0.01 to ask Holdtil's question before it sells stock: "is the price fresh and fair, and how much should I sell?" It answers `sell` (with amounts and a fair floor) or `wait` (with the reason). Same rule and code as Holdtil's own refills. Hosted on Bankr x402 Cloud (`bankr/x402/fair-price/`).
- **Holdtil skill for Bankr agents.** A Bankr agent can keep its budget in NVDAc and top up its USDC on demand ("holdtil refill"): it pays the fair-price check, then sells with Bankr's own swap only at or above the fair floor (`bankr/skills/holdtil/`).
- **Base Builder Codes.** Every refill carries Holdtil's Base Builder Code (ERC-8021), so Base credits the onchain activity to Holdtil.

### Holdtil for Bankr agents

Bankr agents trade from their own Bankr wallet, so Holdtil's spender can't refill them. Instead, Holdtil sells them the one thing that's hard to get right: the decision.

1. The Bankr agent's USDC drops below its floor.
2. It calls Holdtil's fair-price check on Bankr x402 Cloud and pays $0.01 in USDC.
3. If the answer is `wait` (market closed, price off), it does nothing.
4. If the answer is `sell`, it quotes Bankr's swap, and swaps only if the quote is at or above Holdtil's fair floor.

Status: the code and tests are done; the owner deploys the check to Bankr and tests the skill in a real Bankr wallet next.

## 5. First time here? A guide for new users

This guide is also on the [`/docs`](client/src/pages/Docs.jsx) page, under "First time here".

**Before you start, you need:**
1. **A Base Account.** This is Coinbase's smart wallet on Base. You sign in with it, with no password. If you don't have one, the sign-in window helps you create one.
2. **Some tokenized stock in that Base Account.** NVDAc, AAPLc, TSLAc, METAc, GOOGLc or MSFTc. This is where your agent's budget lives. See [base.org/stocks](https://www.base.org/stocks). Tokenized stocks are not available to US persons.
3. **Your agent's wallet address.** This is the `0x…` address your agent pays from. See [section 7](#7-add-your-real-agent) if you're not sure.

**Then, about five minutes in the app:**
1. **Sign in with Base.** Open the app and press **Sign in with Base**. Your wallet asks you to sign a message. Signing is free and moves no money.
2. **Confirm who you are.** Tick "I am not a US person" and accept the risk note.
3. **Add your agent.** Give it a name, paste its wallet address and pick the stock it pays from. Keep the safe default limits or set your own. The address can't be changed later, because that's what keeps your money from going anywhere else.
4. **Sign a Spend Permission** for that stock: how much Holdtil may use per day (for example 0.01 NVDAc). Your wallet shows exactly what you're signing. Signing moves no money. Leave a little room for the $0.02 gas fee.
5. **Done.** Open the dashboard. You'll see each agent's USDC float, its floor and target, and how much has been refilled today. When the float drops below the floor, the next check (every 5 minutes) refills it if the price is fair.

**How to check it's working:** open the agent's page. Every check that did something shows up there as a refill (with a BaseScan link) or a wait (with the reason, like "Price off, waited").

## 6. How to use it day to day

| You want to… | Do this |
|---|---|
| See how your agents are doing | **Dashboard**: float bars, refilled today, permissions left today |
| See why it did or didn't refill | **Agent page → Refills and decisions** |
| Change limits | **Agent page → Limits → Save** |
| Pause one agent | **Agent page → Pause agent** |
| Stop everything now | **Dashboard → Stop all**. Press **Resume all** to start again |
| Give a bigger or smaller daily allowance | **Dashboard → New permission** |
| Cut Holdtil off for good | **Dashboard → Revoke** on the permission (your wallet confirms it) |
| Take everything out | Your stock is already in your wallet and the USDC is in your agent's wallet. See [docs/withdraw.md](docs/withdraw.md) |

## 7. Add your real agent

**Yes, real agents work today, with no code change.** Holdtil doesn't talk to your agent at all. It only watches the agent wallet's USDC balance and sends USDC to it.

**Your agent qualifies if:**
- It pays from **its own wallet on Base** (a private key it holds, a CDP wallet, or any EVM wallet), and
- it pays in **USDC on Base**, for example x402 payments or plain USDC transfers.

**Steps:**
1. Find the agent's wallet address. If it uses viem, that's `privateKeyToAccount(KEY).address`. If it uses a CDP wallet, copy the address from the CDP portal. For x402 clients, it's the account you pass to the payment scheme.
2. In Holdtil: **Dashboard → Add agent**, then paste the address and set the floor (when to refill) and target (how high to fill).
3. Make sure you have an active **Spend Permission** for the agent's stock, with enough per day to cover the refills and their small gas fees.
4. Send the agent a little USDC to start with, or let the first refill do it once the float is below the floor.

This is exactly how our own agent, Holdtil Scout, pays for market data (see `scout/`):

```js
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: 'eip155:8453', client: new ExactEvmScheme(account) }],
});
await paidFetch('https://example.com/paid-api');
// Nothing else changes. Add account.address as an agent in Holdtil.
```

**Rollout:** real refills run only for accounts on the server's live list (`LIVE_USER_ADDRESSES`). Every other account runs as a **dry run**: Holdtil checks the price, runs a test of the transaction, and logs "this is what I would have done" without sending anything. When the owner sets the list to `*`, every user is live under the limits they set, with a $25 site-wide cap per refill.

**You pay your own gas.** Each refill also sells a small fixed gas fee ($0.02 by default, never more than $0.05) of the same stock, in the same transaction, to Holdtil's fee wallet. It counts toward your limits and shows on the receipt. Holdtil never holds your money; the fee only pays back the gas the spender spent on your refill.

## 8. Accounts: one person, one wallet, their own agents

- **Your account is your Base Account address.** There is no email and no password. You sign in by signing a one-time message (Sign in with Ethereum). Smart-wallet signatures are checked properly (ERC-1271 and ERC-6492).
- **Each person has their own:** agents, limits, Spend Permissions, daily cap, Stop switch and receipts. The API only ever returns your own data, and tests check this.
- **Each person's stock stays in their own wallet.** Holdtil has one spender, but it can only pull from you up to the permission you signed, and only to refill one of your own agents.
- **Your daily cap covers all your agents together.** Two agents can't add up to more than your account limit.
- **Sessions** use a random token in an `httpOnly`, `sameSite` cookie (`secure` in production). The server only stores a SHA-256 hash of the token.
- **The public `/proof` page** shows only Holdtil Scout's own activity, never other users' data.

## 9. Security: what Holdtil can and cannot do

**Holdtil can:**
- Use up to your daily Spend Permission allowance of the stock you chose,
- only to swap it to USDC at a fair price,
- only to send that USDC to an agent wallet you registered.

**Holdtil cannot:**
- Hold your funds or your keys. It never asks for a private key.
- Move more than your permission allows. The Spend Permission Manager contract enforces the allowance onchain.
- Send USDC anywhere else. The recipient comes only from your stored agent record, and the transaction builder refuses tokens, pools, the spender and your own wallet as recipients.
- Keep going after you stop it. Stop, Pause and Revoke are all re-read right before every send.

**The only other place money can go:** the fixed gas fee (at most $0.05 per refill) goes to Holdtil's fee wallet, set by the owner in server config. The transaction builder refuses a fee wallet that is your wallet, your agent, the spender or any known contract.

**How a sale is protected, in order:**
1. **Kill switches:** global pause, your Stop, the agent's Pause, and a revoked permission all mean no sale.
2. **Fair price:** a fresh reference price and a gap within 1%.
3. **Limits:** per refill, per agent per day, per account per day, and the allowance left onchain.
4. **Simulation:** the whole transaction is tested against real Base state first. If the test fails, nothing is sent.
5. **Min-out and deadline:** the swap must return at least a set amount of USDC, quickly, or the whole transaction reverts.
6. **One at a time:** a unique database index allows one refill in flight per agent. The refill is saved as "sent" before it's sent, so a crash can never send it twice.

**Fail closed:** any value Holdtil can't read (price, balance, decimals, permission) means no sale.

**Platform:**
- Rate limits on sign-in, reads and writes.
- Cross-site writes are refused.
- The refill timer endpoint needs a secret.
- Raw errors (which could contain keys) are never stored or shown.
- An agent pauses itself after 2 failed transactions in 24 hours.
- Every contract address comes from an official source, which is linked next to it in [`server/src/config/addresses.js`](server/src/config/addresses.js).

## 10. Security proof

**Real transactions on Base mainnet.** You can open every one:

| Date (UTC) | What | Amounts | Transaction |
|---|---|---|---|
| 2026-11-25 11:22 | First refill: owner's NVDAc → USDC to an agent, in one user op (Spend Permission + Aerodrome) | 0.00665098 NVDAc → 0.988785 USDC (min-out 0.983841) | [0x576245f2…8655](https://basescan.org/tx/0x576245f2149007aeafc3fdc32efd2982d6fd24ae1cca4e4e72b470d75aa58655) |
| 2026-11-25 11:55 | Second refill: the rest of that day's permission | 0.00334870 NVDAc → 0.494924 USDC | [0x062d974c…c815](https://basescan.org/tx/0x062d974c2c4c3ef32b5d86046ca08a426828f19f29bbc89eb3e0cd1506fbc815) |
| 2026-11-25 12:02 | Holdtil Scout pays x402stock.xyz for market data over x402 | 0.03 USDC | [0x57a8130e…f3db](https://basescan.org/tx/0x57a8130e63de6c5ddd17daa51af113819cc8a2524f9455d4a8e912ef660cf3db) |

Scout's first payment was funded by a manual 0.10 USDC transfer, because that day's permission was already used. Holdtil's refills of Scout follow and show up on `/proof`.

**The guard saying "no" on mainnet, live.** On 2026-11-26 (US Thanksgiving, stock market closed) the owner ran a live tick. An agent's float was low, so Holdtil wanted to refill it. But the NVDA reference price was almost 12 hours old, so Holdtil refused to sell and waited. No transaction was sent.

| Time (UTC) | Mode | Agent result | Why |
|---|---|---|---|
| 2026-11-26 12:11 | Live (real money allowed) | `waited` · `price_stale` | "reference is 42846s old" (about 11.9 h). Tick `t5985650`, refill `2513bd27…cf1`. The other agent: `not_needed`. |

This is the core rule working for real: never sell your stock unless the price is fresh and fair. Otherwise wait.

**"Break it" tests.** Each attack or bad moment has a test that proves nothing is sent (`server/test/executor/tick.test.js`, `server/test/core/`, `server/test/db/`):

| Bad moment | Result the tests prove |
|---|---|
| Exchange price far from the reference (earnings spike of ~5%) | `price_gap_too_wide`: waits, no transaction |
| Reference price stale (weekend) | `price_stale`: waits, no transaction |
| Over a daily limit (agent or whole account) | `limit_exceeded`: no transaction |
| Permission revoked, missing or used up | `permission_revoked` / `allowance_exhausted`: no transaction |
| Owner presses Stop, including between the test run and the send | `paused`: no transaction |
| Someone tries to change the destination | The API refuses, and the transaction builder refuses anything but the agent wallet |
| 2, or even 20, checks at the same moment | Exactly one refill |
| Crash after sending | The refill stays locked and is never sent again |
| Token decimals onchain differ from config | Nothing is sold |
| Chain or price unreadable | Nothing is sold (fail closed) |
| Account not on the live list | Dry run only, nothing sent |
| Gas fee sale below its minimum, or no fee wallet set | Nothing sent |
| A typo in the site-wide cap setting | The server refuses to start |

**Fork tests on real Base state.** `npm run test:fork` runs the real refill transaction (for all six stocks, with and without the gas fee) against Base mainnet with `eth_simulateV1`, using throwaway wallets. It sends nothing. When the market is closed and the pool has drifted more than 1% from the last Chainlink price, the happy-path cases fail with "Too little received": that is the min-out doing its job, the same reason a live refill waits.

**Independent reviews.** Fresh-eyes reviews, by agents that didn't write the code, came before any real money: Checkpoint B on the executor, Checkpoint C (a full security review), and a review of live refills for all users with the gas fee. Every finding and fix is listed in [PROJECT_STATE.md](PROJECT_STATE.md) §10.

What's real and what isn't, stated plainly: [REAL_VS_MOCKED.md](REAL_VS_MOCKED.md).

## 11. Why Base

Holdtil needs three things in one place, and Base is where they all live:

1. **Tokenized stocks.** Coinbase tokenized stocks (B20, like NVDAc) are native on Base, with official Chainlink reference feeds.
2. **Agent payments.** x402 settles in USDC on Base, and it's busy: Base reported 3.1 million x402 transactions in 30 days.
3. **Limits users control.** Base Account Spend Permissions let a user give a hard, revocable, daily allowance without handing over keys. That is what makes "no custody" possible.

On top of that, Base fees are tiny, so a $1 refill makes sense, and Sign in with Base gives every user a smart wallet with no password.

| Base tool | Job in Holdtil | Code |
|---|---|---|
| Coinbase tokenized stocks (B20: NVDAc, AAPLc, TSLAc, METAc, GOOGLc, MSFTc) | The assets sold for refills | `server/src/config/addresses.js` |
| Base Account + Sign in with Base | Login and permission signing | `client/src/wallet.js`, `server/src/routes/auth.js` |
| Spend Permissions | Daily limit the user signs and can revoke | `server/src/chain/spendPermission.js` |
| Chainlink tokenized equity feeds | Reference price for the fair-price guard | `server/src/chain/priceFeed.js` |
| Aerodrome Slipstream | Stock → USDC swaps with min-out and deadline (agent + gas fee) | `server/src/chain/quote.js`, `server/src/chain/refillBatch.js` |
| CDP smart account | Sends each refill as one ERC-4337 user op; holds gas only | `server/src/chain/spender.js` |
| Base Builder Codes (ERC-8021) | Attribution suffix on every refill user op | `server/src/chain/builderCode.js` |
| x402 v2 (`exact`) | How agents pay; Scout pays x402stock.xyz | `scout/src/` |

| Partner | Job in Holdtil | Code |
|---|---|---|
| Bankr x402 Cloud | Hosts and sells Holdtil's fair-price check ($0.01 per call) | `bankr/x402/fair-price/` |
| Bankr skills | Lets Bankr agents refill from stock through the check and Bankr's swap | `bankr/skills/holdtil/` |

## 12. Tech stack and architecture

| Layer | Tools |
|---|---|
| Web app | React 19, Vite 8, React Router 7, Bootstrap 5 (custom theme), lucide icons, Geist and Instrument Serif fonts |
| Wallet | Base Account SDK (`@base-org/account`): Sign in with Base and Spend Permissions |
| API and executor | Node 22, Express 5, viem 2, MongoDB 7 driver |
| Sending | Coinbase CDP SDK: a smart account (ERC-4337) as the spender |
| Onchain | Base mainnet: six B20 stocks, USDC, Chainlink feeds, Aerodrome Slipstream, Spend Permission Manager, Builder Codes (`ox/erc8021`) |
| Partner | Bankr x402 Cloud (TypeScript handler) and Bankr skills |
| Agent payments | x402 v2: `@x402/fetch` and `@x402/evm` (Holdtil Scout) |
| Tests | Vitest, in-memory MongoDB, `eth_simulateV1` fork tests on real Base state |
| Quality | ESLint 10 (zero warnings), `npm run verify` as the gate |
| Hosting (planned) | Vercel (app), Render (API), MongoDB Atlas, cron-job.org (5-minute timer), GitHub Actions (Scout, hourly) |

```
Browser (React, Vite)  ──/v1 (same origin)──►  API (Node, Express) ── MongoDB Atlas
  Sign in with Base, sign Spend Permission        │
                                                   ├─ every 5 min (cron) → executor
User's Base Account (holds stock) ◄── Spend Permission Manager ◄──┤   CDP smart account (spender, gas only)
Agent wallet ◄── USDC ── Aerodrome Slipstream stock/USDC ◄────────┤   Chainlink feeds (24/5 reference)
Fee wallet   ◄── $0.02 USDC gas fee, same transaction ◄──────────┘
Holdtil Scout (GitHub Actions, hourly) ── x402 ──► x402stock.xyz
Any agent ── x402 $0.01 ──► Bankr x402 Cloud: Holdtil fair-price check ──► sell / wait
```

**Judge path, 60 seconds:**
1. Open `/proof`: Scout's real x402 payments and the refills that fund them, each with a BaseScan link.
2. Open the first refill above. It's one user operation: `approveWithSignature` + `spend` (Spend Permission), then `approve` + `exactInputSingle` (Aerodrome) with a min-out, with the USDC going straight to the agent. Refills now add a second `exactInputSingle` for the gas fee.
3. Read `/docs`: the product in plain words, and how any agent connects with zero code.
4. Run `npm run verify`: the tests block every "break it" case above.

## 13. Run it locally

Needs Node 22+ and MongoDB. Copy `server/.env.example` to `server/.env` and fill in your own values. Never commit them.

```bash
npm install
npm run dev        # API on :3001, app on :5173
npm run verify     # lint + tests + build (the gate)
npm run test:fork  # real Base mainnet state via eth_simulateV1; sends nothing
npm run tick       # one refill check (dry unless EXECUTOR_MODE=live)
npm run scout      # one Holdtil Scout run (dry unless SCOUT_MODE=live)
```

Repo map: `server/` is the API and executor, `client/` the web app, `scout/` our x402 agent, `bankr/` the fair-price check and skill for Bankr, and `docs/` the Gate 0 report and guides. Requirements are in [PRD.md](PRD.md), progress in [PROJECT_STATE.md](PROJECT_STATE.md), and future ideas in [ROADMAP.md](ROADMAP.md).

## 14. Known limits

- Six stocks. Their pools are small, so refills are small. The Bankr check and skill are NVDAc only for now.
- Real refills are on for the owner's account only until the owner turns them on for everyone (`LIVE_USER_ADDRESSES=*`, after deploy). Until then other accounts run as dry runs.
- A very small refill still pays the fixed $0.02 gas fee, so keep the floor and target a few dollars apart.
- At weekends and on market holidays the reference price is stale, so refills wait. Keep enough USDC float to cover a weekend.
- Your budget is in stock, so its value moves with the stock price.
- The API runs on Render's free tier, and a timer keeps it and the database awake.
