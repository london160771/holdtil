# PRD — Holdtil

**Your agent's budget stays invested until it pays.**

| | |
|---|---|
| **Status** | Draft — build against this |
| **Version** | 1.0 |
| **Date** | 2026-11-24 |
| **Owner** | Adesope (Ayyoweb3) |
| **Hackathon / track** (H) | Base Stocks Maxxing Season — Agentic Stock Finance (also ask partners if Programmable Stock Markets can be entered too) |
| **Application deadline** (H) | 2026-12-05, 11:59pm EST (= 2026-12-06, 05:59 WAT) |
| **Official deadline** (H) | 2026-12-12, 11:59 PM UTC (base.org/stocksmaxxing FAQ, checked 2026-11-25). Entry = public X post with a video demo tagging @buildonbase + the submission form |
| **Internal cutoff** (H) | 2026-12-11, 12:00 WAT |
| **Links** | Repo: https://github.com/london160771/holdtil · Live: [ ] (holdtil.xyz planned) · Video: [ ] · Public proof page: [ ] · X: @holdtil [ ] |

> **This file is the only source of truth for requirements.** Agents read the relevant section before building and cite it (e.g. "PRD §11"). The PRD is corrected by evidence: when reality disagrees, fix this file and log it in §16.
> This is a **real product on Base mainnet with real money**, not a judge demo. Real users sign up, sign in and use it.

---

## 1. One-line definition

Holdtil is a stock-backed wallet manager for AI agents that lets agent owners keep their agent's money in tokenized stocks (like NVDAc) and pay the agent's x402 bills from it, instead of leaving that money idle in USDC.

**Memorable flow (use it everywhere — code, UI, README, video):**

```
FUND WITH STOCK → AGENT PAYS → FLOAT RUNS LOW → FAIR-PRICE REFILL (receipt) → PRICE OFF? WAIT → OWNER STOPS IT ANYTIME
```

---

## 2. The story (the video's spine)

- **Act 1 — The dangerous default.** Agents on Base now pay for their own data and tools with x402. Their money waits in a wallet as idle USDC. A naive fix ("just sell some stock when the agent needs cash") can sell at a bad price: on Nvidia's earnings night the NVDAc pool on Aerodrome moved from about $209.87 to $220.66 within hours while the real market was closed.
- **Act 2 — The new way.** Owner signs in with Base, funds the setup with NVDAc, adds an agent wallet, and grants Holdtil a limited Spend Permission.
- **Act 3 — The real action.** The Holdtil Scout agent pays for real stock data over x402. Its float runs low. Holdtil sells a tiny amount of NVDAc at a fair price and tops it up. A receipt shows the BaseScan tx hash and the gap from the reference price.
- **Act 4 — Break it.** Price too far from reference → Holdtil waits and logs why. Over the daily limit → blocked. Two ticks at once → one refill. Stale price → blocked.
- **Act 5 — Control returns.** Owner presses "Stop all agents" or revokes the permission. Refills stop instantly.
- **Close.** "Base already has agents that pay, and stocks you can hold onchain. What it lacked was a way for an agent's money to stay invested until the moment it pays. Holdtil is that."

---

## 3. Problem

**Tiny scenario with numbers:** A builder tops up their research agent with $100 USDC every month. On any given day most of it sits unused. If they hold NVDAc instead and a script sells it whenever the agent runs low, one refill during an earnings spike or a weekend gap can sell at a price several percent away from the real stock price.

**Why it happens:** Agent payments (x402) are paid in USDC, so agent wallets must hold USDC. Tokenized stocks trade 24/7 but the real market and its reference prices do not, so "sell when needed" is unsafe without a price check and limits.

**Who feels it and how often:** Builders and small teams running paying agents on Base. x402 is busy: Base reported 3.1 million x402 transactions in 30 days. Every refill decision is a chance to sell badly.

---

## 4. Insight and core guarantee

**Insight:** You cannot control when an agent needs money. But you can control when stock is sold to pay for it.

**Core guarantee:** **Holdtil never sells a user's stock unless the price is fresh, fair and within the user's limits. Otherwise it waits.**

Invariant form: every confirmed refill has `gapBps ≤ maxGapBps`, `priceAge ≤ maxPriceAge`, and `spentToday ≤ dailyLimit`.

---

## 5. The gap

**Ecosystem today:** Coinbase for Agents and Bankr let agents trade stocks. Bitwise ATPs and Glider run rules-based stock portfolios. Leash (Stocks Maxxing) lets an agent rebalance a stock vault inside an onchain mandate. Research-to-Treasury (Stocks Maxxing) sells research for USDC and sweeps profits into stocks. Polygon's toolkit sweeps idle agent USDC into lending.
**What's missing:** the **spending side** — paying an agent's x402 bills straight from a stock treasury, selling only at fair prices.

| Existing project / tool | What it owns | How we differ / compose with it |
|---|---|---|
| Leash | Agent rebalancing inside a vault mandate | We don't rebalance portfolios. We only fund an agent's spending. |
| Research-to-Treasury Agent | Earn USDC → buy stocks | Opposite direction. We hold stocks → pay bills. Complementary. |
| Bitwise ATP / Glider | Model portfolios | We don't pick portfolios. |
| Coinbase for Agents / Bankr | Agents that trade | Their agents could use Holdtil to fund spending. |
| x402stock / Massive | Sell data to agents over x402 | Our Scout agent is their customer. |

**We must not be:** another trading bot, another portfolio vault, another dashboard.

---

## 6. Users and jobs to be done

| User | Needs | Success looks like |
|---|---|---|
| Agent owner (solo builder, small team) | Keep agent funds invested; never sell stock at a bad price; hard limits; instant stop | Agent keeps working; refills only at fair prices; receipts for every sale |
| Agent (software) | USDC available when an x402 bill comes | Float never empties while limits allow |
| **Judge** (H) | See it's real without signing up | Public proof page shows the Scout agent's live receipts and tx hashes in ≤ 60 s |

**Primary user story:** As an agent owner, I want my agent's budget held in stocks and refilled only at fair prices, so my money stays invested and I never sell at a bad moment.

---

## 7. Goals and non-goals

**Goals**
- **G1 (Real):** Real users sign in, grant a permission, add an agent, and get real refills on Base mainnet.
- **G2 (Safe):** No refill ever breaks §11. Limits, waits and stops all work and are tested.
- **G3 (Proof):** A public proof page shows real Scout agent payments and refills with BaseScan links.

**Non-goals (this build will not):**
- Hold user funds or user keys.
- Pick stocks, rebalance portfolios, give investment advice.
- Offer lending, leverage, perps or its own token.
- Serve US persons.

---

## 8. Product principles

1. **Fail closed.** Unknown price, stale price, failed simulation or unknown state = no sale.
2. **Real over mocked.** Mainnet only for the product. Anything else is labelled (§17).
3. **Evidence before spectacle.** Every number on screen comes from the database or chain, never typed in.
4. **User keeps final control.** User-set limits and the Spend Permission are the hard ceiling. Stop and revoke always work.
5. **Non-custodial.** Holdtil can only move what the Spend Permission allows, and only to the user's own agent wallet.

---

## 9. Core flow and user journeys

**End-to-end flow:**
1. Owner signs in with Base Account (Sign in with Base). Confirms not a US person and accepts terms.
2. Owner adds an agent: name + agent wallet address + float settings (floor, target).
3. Owner grants Holdtil a Spend Permission on a stock token (NVDAc first) with a daily allowance.
4. Every 5 minutes the tick runs. For each active agent: read the agent's USDC balance.
5. If balance < floor: plan a refill of `target − balance`.
6. Price check: Chainlink reference (fresh?) vs DEX quote for the sale (gap within limit?). Limit check: today's total + this refill ≤ daily limit.
7. If all pass: simulate, then send one atomic batch — spend permission pull → swap stock to USDC with min-out → send USDC to the agent wallet.
8. Save a receipt with tx hash, amounts, reference price, quote price, gap.
9. If a check fails: record a "waited" or "blocked" decision with a reason code. Try again next tick.
10. Owner can pause an agent, press "Stop all agents", or revoke the permission at any time.

**Journey A — happy path:** Dashboard shows agent card → float bar drops as Scout pays → refill appears in the receipts list with "Fair: 0.03% from reference" and a BaseScan link.
**Journey B — unfair price:** Tick finds gap > limit → receipts list shows "Waited: price 3.1% off reference" → next fair tick refills.
**Journey C — stop / revoke:** Owner presses Stop → all agents paused → next tick logs `paused`, no transaction. Revoke in wallet → tick logs `permission_revoked`.

---

## 10. Functional requirements

| ID | Pri | Requirement | Acceptance criteria |
|---|---|---|---|
| FR-AUTH-001 | P0 | Sign in with Base Account; server verifies the signature (smart-wallet aware) and sets a session cookie. | Valid signature → session; tampered/replayed nonce → `auth_failed`. |
| FR-AUTH-002 | P0 | Signup requires "I am not a US person" confirmation and terms acceptance. | Without both, no agent or permission can be created. |
| FR-AGT-001 | P0 | Add/edit/pause an agent: name, wallet address, floor USD, target USD. | Invalid address or floor ≥ target → validation error. |
| FR-PRM-001 | P0 | Grant a Spend Permission on an allowed stock token with allowance + period, signed in the user's Base Account. | Permission stored with hash; shown as active with remaining allowance. |
| FR-PRM-002 | P0 | Detect revoked/expired permissions and stop using them. | Revoked → next tick `permission_revoked`, no tx. |
| FR-RFL-001 | P0 | Tick every 5 min refills agents below floor, following §9 steps 4–9. | Fork test: low float → one confirmed refill to the agent wallet. |
| FR-RFL-002 | P0 | Fair-price guard: fresh Chainlink reference + gap within `maxGapBps`. | Stale or wide gap → `waited` with reason; no tx. |
| FR-RFL-003 | P0 | Limits: per-refill max, per-agent daily max, user daily max. | Over limit → `limit_exceeded`; no tx. |
| FR-RFL-004 | P0 | One refill at a time per agent; idempotent refill IDs. | Two concurrent ticks → exactly one refill. |
| FR-RFL-005 | P0 | Every swap has min-out and deadline; every tx is simulated first. | Simulation fail → `simulation_failed`; no tx. |
| FR-RCP-001 | P0 | Receipts: tx hash, stock sold, USDC received, reference price, quote price, gap, time. | Every confirmed refill has a receipt with a working BaseScan link. |
| FR-CTL-001 | P0 | Per-agent pause, per-user "Stop all agents", global admin pause. | Each blocks the next tick with its own code. |
| FR-SCT-001 | P0 | Holdtil Scout: our own agent that pays x402stock.xyz for real data on a schedule and stores summaries. | Real x402 payments visible on BaseScan; Scout's float is managed by Holdtil. |
| FR-PRF-001 | P0 | Public proof page `/proof`: Scout's live payments, refills, waits, with tx links. No login. | A logged-out visitor sees real data only. |
| FR-FPC-001 | P0 | Fair-price check for any agent, sold per call over x402 on Bankr x402 Cloud (owner pick 2026-11-25). Same rule and code as FR-RFL-002: input stock + USDC wanted; output `sell` (with stock amount and min-out, as Holdtil's refill would use) or `wait` (with reason), plus the Chainlink reference, its age, the Aerodrome quote and the gap. $0.01 USDC per call on Base. Reads only; never trades, holds or moves anyone's funds. | Unit tests: fair → `sell`, stale / wide gap / incomplete round / unknown data → `wait`; bad input → 400 and chain failure → 503 (Bankr charges only on < 400). Live fork read returns a real verdict. Each answered check is recorded and shown on `/proof`. |
| FR-BKS-001 | P0 | Holdtil skill for Bankr agents (owner pick 2026-11-26): the agent keeps its budget in NVDAc in its own Bankr wallet; when USDC on Base is below the owner's floor it pays FR-FPC-001, and only on `sell` sells exactly `sell.stockAmount` with Bankr's own swap, with slippage set so Bankr's minimum = `sell.fairFloorUsdc`. On `wait`, errors, or a Bankr quote below the floor it sells nothing. Holdtil never holds Bankr users' funds or keys; the existing app is unchanged. | Skill format tests (Bankr rules) + numbers match the check; owner dry run in Bankr chat, then one real ≤ $2 refill approved by the owner with its tx hash. |
| FR-LND-001 | P0 | Landing page, "Connect your agent" guide, risk + not-US + not-advice notices. | Visible before signup and in the footer. |
| FR-RSV-001 | P1 | USDC reserve fallback: second permission on the owner's USDC, used only when stock price is unfair and float is critical. | Fork test passes. |
| FR-STK-001 | P1 | More stock tokens (AAPLc, GOOGLc, METAc). | Same tests pass per token. |
| FR-ALR-001 | P1 | Email or Telegram alert on waits, blocks and low allowance. | Alert received in test. |

---

## 11. Domain rules and invariants

- **INV-1 (money):** All amounts are integers in token base units (`bigint` in code, string in MongoDB). No floats in money math. USD values for display only.
- **INV-2 (fair price):** A refill is sent only if the Chainlink reference is fresh (`age ≤ maxPriceAgeSec`) and `|quote − reference| / reference ≤ maxGapBps`.
- **INV-3 (limits):** `refillUsd ≤ maxPerRefill`, `agentSpentToday + refillUsd ≤ agentDailyLimit`, `userSpentToday + refillUsd ≤ userDailyLimit`, and on-chain allowance remaining ≥ amount. All checked before simulation.
- **INV-4 (single flight):** At most one refill per agent in `planned|checked|simulated|sent` state. Enforced by a unique index, not by reading first.
- **INV-5 (destination):** USDC from a refill can only go to the agent wallet registered by that user. The executor never accepts a destination from outside the DB record.
- **INV-6 (allowlists):** Only tokens, routers, feeds and the Spend Permission Manager listed in `server/src/config/addresses.js` (with source links) are ever called.
- **INV-7 (control):** If global pause, user stop, agent pause, or revoked permission is set, no tx is sent.

**Refill state machine:** `planned → checked → simulated → sent → {confirmed | failed}`, and `planned|checked|simulated → {waited | blocked}`. Illegal transitions throw. Every transition is logged with a timestamp. In-flight states (INV-4): `planned`, `checked`, `simulated`, `sent`.

**Error / decision codes** (each with `retryable` and `nextAction`):

| Code | When | Retryable | Next action |
|---|---|---|---|
| `price_stale` | Reference older than limit | yes | Wait for next tick |
| `price_gap_too_wide` | Quote too far from reference | yes | Wait for next tick |
| `limit_exceeded` | Any §INV-3 limit hit | no (until next day) | Owner raises limit or waits |
| `allowance_exhausted` | Permission allowance used up this period | no | Wait for new period or re-grant |
| `permission_revoked` | Permission revoked/expired | no | Owner grants again |
| `paused` | Agent, user or global pause | no | Owner resumes |
| `simulation_failed` | Simulation reverted | yes | Retry next tick; alert after 3 |
| `tx_failed` | Tx reverted or not confirmed | yes | Investigate; alert |
| `refill_in_flight` | Another refill active | yes | Skip this tick |
| `auth_failed` | Bad signature / nonce | no | Sign in again |
| `refill_expired` | Refill stuck in flight (before send) past the timeout | yes | Next tick tries again |

---

## 12. Non-functional requirements

- **Security:** Keys only in env vars, set by the owner. Spender wallet holds gas only. Session cookies httpOnly + secure + sameSite. Input validation on every endpoint. Rate limiting on auth and write endpoints. Tick endpoint protected by a secret header.
- **Reliability:** Idempotent refills; restart-safe state in MongoDB; tick can run twice without harm.
- **Performance:** Tick for 100 agents in < 60 s (target, not measured).
- **Accessibility and mobile:** Works at 390px; keyboard reachable; clear empty, loading and error states.
- **Setup:** Clean clone to running locally in ≤ 10 minutes (needs env vars).
- **Legal notices:** Not for US persons; not financial advice; stocks can go down; Holdtil never holds funds.

---

## 13. Architecture

```
React app (Base Account SDK) ──► Express API ──► Core engine (pure) ──► Chain adapters (viem)
        │                           │                                   ├─ Chainlink feeds (reference price)
        │                           │                                   ├─ DEX quote + swap (min-out)
  User's Base Account               MongoDB Atlas                       ├─ Spend Permission Manager
  (holds NVDAc, signs permission)                                       └─ USDC / stock token reads
                                    ▲
cron-job.org ── every 5 min ──► POST /internal/tick (secret header)

Holdtil Scout (separate Node process) ── x402 ──► x402stock.xyz   (its own wallet, float managed by Holdtil)
```

- **Stack:** React (Vite) + Bootstrap, Node/Express, MongoDB Atlas, viem, Base Account SDK. Solidity only if Gate 0 proves Spend Permissions + batching can't do the job.
- **Components:** `client/` (UI), `server/` (API, tick, executor), `server/src/core/` (pure rules), `server/src/chain/` (adapters), `scout/` (our agent).
- **Trust boundaries:** Browser never sees server secrets. Server never sees user keys. Spender can only use Spend Permissions within allowance. Scout's key lives only in Scout's env.
- **Pure core, effects at the edges:** `core/priceGuard`, `core/limits`, `core/refillPlanner`, `core/stateMachine` take plain data and return decisions; fully unit-tested without network.
- **Hosting:** Frontend on Vercel, API on Render (free) woken by cron-job.org, DB on MongoDB Atlas (free). Owner deploys; agents never deploy.

---

## 14. Data model and API contract

**Collections:**
- `users` — `address` (unique, lowercase), `notUsConfirmedAt`, `termsAcceptedAt`, `stoppedAt`, `dailyLimitUsd`, `createdAt`
- `agents` — `userId`, `name`, `walletAddress`, `floorUsdc` (base units), `targetUsdc`, `maxPerRefillUsdc`, `dailyLimitUsdc`, `status` (`active|paused`), unique (`userId`,`walletAddress`)
- `permissions` — `userId`, `token`, `allowance`, `periodSec`, `start`, `end`, `permissionHash` (unique), `signature`, `status`
- `refills` — `refillId` (unique), `agentId`, `state`, `code`, `stockAmount`, `usdcOut`, `minOut`, `refPrice`, `refPriceAt`, `quotePrice`, `gapBps`, `txHash`, timestamps; partial unique index on `agentId` where `inFlight: true`, set while `state ∈ {planned, checked, simulated, sent}` (INV-4)
- `nonces` — `nonce` (unique), `address`, `expiresAt` (TTL)
- `settings` — `globalPause`
- `scoutRuns` — `runId`, `x402TxHash`, `costUsdc`, `summary`, `createdAt`
- `fairPriceChecks` — `checkId` (unique), `payer`, `stock`, `forUsdc`, `verdict`, `reason`, `gapBps`, `refUsd`, `ageSec`, `block`, `checkedAt`, `createdAt` (FR-FPC-001)

**Endpoints:**

| Method | Path | Input | Output | Errors |
|---|---|---|---|---|
| GET | `/health` | — | status | — |
| GET | `/v1/auth/nonce` | — | nonce | — |
| POST | `/v1/auth/verify` | address, message, signature | session cookie | `auth_failed` |
| POST | `/v1/auth/logout` | — | ok | — |
| POST | `/v1/me/onboard` | notUs, terms | user | validation |
| GET | `/v1/me` | — | user + totals | — |
| POST | `/v1/me/stop` | — | user | — |
| POST | `/v1/me/resume` | — | user | — |
| GET/POST | `/v1/agents` | agent fields | agent(s) | validation |
| PATCH | `/v1/agents/:id` | fields / status | agent | validation |
| POST | `/v1/permissions` | signed permission | permission | validation, `permission_invalid` |
| GET | `/v1/permissions` | — | permissions + remaining | — |
| GET | `/v1/refills` | agentId, page | receipts + decisions | — |
| GET | `/v1/proof` | — | Scout public data | — |
| POST | `/internal/tick` | secret header | summary | 401 |
| POST | `/internal/checks` | `x-check-secret` header + one answered fair-price check (from the Bankr handler) | ok | 401, validation |
| GET/POST | `https://x402.bankr.bot/<wallet>/fair-price` (Bankr x402 Cloud, not our server) | `stock`, `usdc` | verdict + facts | 402 (unpaid), 400, 503 |

No extra MVP endpoints beyond this table.

---

## 15. Sponsor integration and necessity (H)

**Why Base:** Coinbase tokenized stocks (B20) live natively on Base, x402 settles in USDC on Base, and Base Account Spend Permissions give users hard, revocable limits. Holdtil needs all three in one place.

| Base tool | Job it does in the core path | File(s) |
|---|---|---|
| Coinbase tokenized stocks (B20, e.g. NVDAc) | The treasury asset that gets sold for refills | `server/src/config/addresses.js` |
| Base Account + Sign in with Base | Login and permission signing | `client/src/wallet.js`, `server/src/routes/auth.js` |
| Spend Permissions | Hard user limits + revoke | `server/src/chain/spendPermission.js`, `server/src/chain/refillBatch.js` |
| Chainlink tokenized equity feeds on Base | Reference price for the fair-price guard | `server/src/chain/priceFeed.js` |
| Aerodrome Slipstream (per Gate 0) | Stock → USDC swap with min-out | `server/src/chain/quote.js`, `server/src/chain/refillBatch.js` |
| CDP smart account (spender) | Sends the refill batch as one ERC-4337 user op; holds gas only | `server/src/chain/spender.js`, `server/src/chain/executorChain.js` |
| x402 | How agents pay; Scout pays x402stock | `scout/*` |
| Bankr agent + wallet + swap (skill) | Runs Holdtil's refill loop inside a Bankr wallet: the agent pays the check, quotes and swaps NVDAc → USDC with Bankr's swap, under Bankr's own spend limits (FR-BKS-001) | `bankr/skills/holdtil/` |
| Bankr x402 Cloud | Hosts Holdtil's paid fair-price check (FR-FPC-001): runs the handler, verifies and settles each $0.01 USDC payment on Base, lists it for Bankr agents to discover and pay in chat | `bankr/` |
| Base Builder Codes (ERC-8021) | Tags every refill user op so Base attributes the activity to Holdtil (attribution only; on when `BUILDER_CODE` is set) | `server/src/chain/builderCode.js`, `server/src/chain/executorChain.js` |

- **Evaluated and rejected:** Anvil fork for B20 flows (can't run B20 precompiles); 0x / aggregator API (not needed: direct Aerodrome pool is deep enough for small refills, and one fewer API key); the Chainlink 24/7 NVDA feed (we want the 24/5 reference so weekends read as stale and we wait).
- **Upstream contribution:** none planned.
- **Hackathon partners (base.org/stocksmaxxing, 2026-11-25):** Agentic Stock Finance partners are Bankr and BaseStonk. Bankr: x402 Cloud hosts FR-FPC-001 (owner pick 2026-11-25). BaseStonk: not used (launchpad; its stock prices come from the same Chainlink feeds, so no extra check). Possible fit at the token decision.

---

## 16. Decisions log and Gate 0

**Gate 0 — riskiest premises (all on a Base mainnet fork first, then one tiny real tx with owner approval):**
1. A Spend Permission can be granted on NVDAc (B20) and spent by our spender.
2. The spender can do pull → swap (min-out) → send USDC to an agent wallet in one atomic batch.
3. A fresh Chainlink reference price for NVDA exists on Base and can be read with its timestamp.
4. A DEX quote for selling small NVDAc amounts is available and executable.
5. An x402 client can pay x402stock.xyz from a plain wallet on Base.
6. The owner can hold NVDAc from Nigeria (manual check).

- **Option A (ideal):** CDP Server Wallet smart account as spender; batch calls; Aerodrome router direct.
- **Option B (fallback):** Small audited-pattern executor contract owned by the spender that does pull + swap + send in one call; or an aggregator API (0x / 1inch) for the swap.
- **Acceptance:** all 6 pass with raw evidence (fork logs, tx hashes).
- **Result (2026-11-24): Option A chosen. Premises 1–6 pass** in simulation / read / dry run. Raw report: `docs/gate0/2026-11-24-gate0-report.json` (re-run: `npm run gate0`). The "one tiny real tx with owner approval" is moved to the owner-approved stops already planned: permission signing (Phase 2) and the $1 refill (Phase 3), because a real tx needs the owner's Base Account and the CDP spender.

| # | Premise | Result | Evidence (Base mainnet, 2026-11-24) |
|---|---|---|---|
| 1 | Spend Permission on NVDAc spent by our spender | Pass (simulated) | `approveWithSignature` + `spend` on NVDAc succeeded inside the batch (block 61760759). Revoked, over-allowance and wrong-spender all reverted. |
| 2 | Pull → swap (min-out) → USDC to agent in one atomic batch | Pass (simulated) | Smart-wallet `executeBatch`: user 0.05→0.04 NVDAc, agent got 1.530096 USDC (min-out 1.522445), spender kept 0. Min-out above quote → `Too little received`, whole batch reverted, user kept all NVDAc. |
| 3 | Fresh Chainlink NVDA reference with timestamp | Pass (real read) | Feed `0x0468…8513` "Coinbase NVDA", 8 dec, answer 153.54255219, updatedAt 17:29:23Z, age 1164 s at block 61760758. Same feed as Coinbase API `/nav-feeds`. |
| 4 | Executable DEX quote for a small sale | Pass (real quote + simulated swap) | Aerodrome Slipstream pool `0x853F…7ab9` (tick spacing 10, 0.05% fee, ~1,780 NVDAc / ~18,740 USDC): 0.01 NVDAc → 1.530096 USDC, gap 34 bps vs reference. |
| 5 | x402 client can pay x402stock.xyz from a plain wallet | Pass (dry) | 402 asks x402 v2 `exact`, `eip155:8453`, USDC, 30000 ($0.03). A real signed payment from an empty throwaway wallet was refused only with `insufficient_funds`. No money moved. |
| 6 | Owner can hold NVDAc from Nigeria | Pass (manual) | Owner bought ~$1 NVDAc on Aerodrome. |

**Gate 0 findings that change how we build (evidence above):**
- **Anvil cannot run B20 tokens.** B20 stocks are Base-native precompiles (code `0xef`). On an Anvil fork every NVDAc call fails with `EVM error OpcodeNotFound` (anvil 1.5.1-stable). Chainlink and Aerodrome reads work on Anvil. So "fork tests" for anything that touches a B20 token run as `eth_simulateV1` on a real Base node (state overrides, nothing broadcast). `npm run test:fork` does this.
- **The reference feed is per token.** Coinbase feeds report total-return value (underlying price × multiplier), so the feed answer compares directly with the DEX price per NVDAc. No extra multiplier math in the price guard; still read balances fresh (CLAUDE.md §9).
- **Swap venue:** Aerodrome Slipstream "Gauges V3" deployment (router + quoter in `addresses.js`). The deep NVDAc/USDC pool lives there. Other NVDAc pools (v2, tick spacings 1 and 200) hold only dust.
- **CDP spender:** CDP smart accounts are Coinbase Smart Wallet v1.1 (same factory as Base Accounts). Creating the dev spender is blocked by a CDP setup step (see PROJECT_STATE §1).

**Resolved decisions — do not re-litigate:**

| Date | Decision | Reason / evidence |
|---|---|---|
| 2026-11-24 | Product name: **Holdtil** ("hold till you pay") | Domains free; no clash found. Bursar, Purser, Holdfast, StockTab, StockPurse rejected (taken). |
| 2026-11-24 | Build on Base **mainnet**, real product with signup/sign-in, real users | Owner decision; testnet B20 tokens don't exist and Sepolia swaps reported broken |
| 2026-11-24 | Focus on the **spending side** only; no portfolio rebalancing | Leash and Research-to-Treasury already cover nearby ground |
| 2026-11-24 | Track: Agentic Stock Finance (Programmable Stock Markets too if allowed) | Best fit; form allows listing tracks |
| 2026-11-24 | Non-custodial via Spend Permissions; no own token | Safety + legal simplicity |
| 2026-11-24 | Budget ≈ $10: holdtil.xyz ($1.49), free hosting, ~$8 onchain test money | Owner budget |
| 2026-11-24 | Stack: React + Bootstrap, Node/Express, MongoDB Atlas, viem | Owner stack; no Tailwind |
| 2026-11-24 | Owner deploys; agents never deploy | Owner rule |
| 2026-11-24 | Gate 0 #6 passed: owner holds NVDAc from Nigeria | Bought ~$1 NVDAc via Aerodrome |
| 2026-11-24 | Gate 0 passed; Option A (CDP smart account spender, batch calls, Aerodrome router direct) | See Gate 0 result above |
| 2026-11-24 | B20 flows are tested with `eth_simulateV1` on Base mainnet state, not Anvil | Anvil fork: NVDAc `decimals()` → `EVM error OpcodeNotFound`; Base node runs it fine |
| 2026-11-24 | Reference price = Chainlink "Coinbase NVDA" 24/5 feed `0x04689a41629776563E6822F76f2e57D148d28513` | Listed for NVDAc by Coinbase API `/v1/tokenized-stocks/nav-feeds` and Chainlink directory |
| 2026-11-24 | Swap venue = Aerodrome Slipstream Gauges V3 pool `0x853F5f1B92b16714Fe6CDA67CAad0856B83C7ab9` | Only NVDAc pool with real liquidity (checked on chain via official factories) |
| 2026-11-24 | Base Account SDK docs moved to CDP ("Coinbase Wallet SDK"); package is still `@base-org/account` | docs.base.org/sdks/migrated-products |
| 2026-11-24 | INV-4 covers every in-flight state: `planned`, `checked`, `simulated`, `sent` (§11 listed only three; `checked` is in flight too). Enforced by a partial unique index on `agentId` where `inFlight: true` | A refill in `checked` must also block a second refill; flag field is simpler than `$in` in a partial index |
| 2026-11-24 | Refill size = `min(target − balance, maxPerRefill)` | Keeps INV-3 true instead of blocking forever when the gap is bigger than the per-refill max |
| 2026-11-24 | Swap min-out = max(quote − slippage, reference value − `maxGapBps`) | Puts the fair-price rule on chain too: if the pool moves after the quote, the swap reverts instead of filling unfairly |
| 2026-11-24 | Spend-today counts confirmed refills (actual USDC out) + in-flight refills (planned USDC); days roll over at 00:00 UTC | Fail closed: in-flight money counts against the limit |
| 2026-11-24 | Decision state: retryable codes → `waited`, others → `blocked` (so `simulation_failed` → `waited`) | Matches the retryable column in §11 |
| 2026-11-24 | Checkpoint A fixes: `simulated → waited/blocked` allowed (pause, revoke or crash between simulate and send); stale `planned/checked/simulated` refills expire to `waited` (`refill_expired`) after 15 min; stale `sent` refills are only reported and must be checked on chain (Phase 3) | Fresh-eyes review: otherwise a crash locks an agent forever |
| 2026-11-24 | Limits (INV-3) are checked against the most a sale can pay out: max(quote, reference value + `maxGapBps`), not the planned USDC | Review: buffer or a good quote could push a day past its limit. A fill above that bound needs the pool to jump past the fair band in the same block |
| 2026-11-24 | Price guard refuses mismatched price units and incomplete Chainlink rounds (`price_stale`) | Review finding; fail closed |
| 2026-11-24 | Phase 3 must: write the tx hash before broadcast; check stuck `sent` refills on chain; add the wrong-destination fork test (lab #7); show the reference floor in the executor simulation (Gate 0 sim used quote − 50 bps only) | Review findings carried forward |

| 2026-11-24 | Agent limits: defaults floor $1, target $3, max per refill $2, daily $5 per agent, $10 per user. Hard caps: target $50, per refill $25, daily $50 per agent, $100 per user (`server/src/config/limits.js`) | Small safe defaults for rollout step 4–5 (CLAUDE.md §6) |
| 2026-11-24 | Spend permissions accepted only if: account = signed-in user, spender = Holdtil spender, token on the allowlist, allowance > 0, period 1 h–31 d, lifetime ≤ 366 d, and the signature verifies on chain (ERC-1271/6492) | INV-6 and fail closed |
| 2026-11-24 | Sessions: random token in an httpOnly `SameSite=Lax` cookie; only its sha256 is stored (7-day TTL). Production must serve `/v1` on the same origin as the app (Vercel rewrite to Render) | Lax cookies don't cross sites; avoids CORS + third-party cookie problems |
| 2026-11-25 | Sign in with Base: the app builds the SIWE message itself (chain 8453), switches the Base Account provider to Base first, and signs with `personal_sign`. We don't use the `wallet_connect` SIWE capability | Owner's first real try (2026-11-25) got a message for a non-Base chain → "Wrong network" |
| 2026-11-24 | Sign in with Base: nonce is one use (atomic delete), SIWE checks domain, URI = `APP_ORIGIN`, chain 8453. Verify with viem (ERC-1271/6492); if that fails and the address has EIP-7702 code (`0xef0100…`), accept plain ECDSA recovery equal to the address | Owner's smart wallet is a 7702 account (M10); its owner key is the address itself |
| 2026-11-24 | `GET /v1/me` also returns `chain {chainId, spenderAddress, stocks}` (public values the app needs to request a permission). New error codes: `onboarding_required`, `permission_invalid`, `chain_unavailable`, `refill_expired` | Keeps addresses server-side as the one source (CLAUDE.md §6) |
| 2026-11-25 | Executor settings: max reference age 1 h, max gap 100 bps, quote slippage 50 bps, fee buffer 50 bps, swap deadline 300 s (`server/src/config/executor.js`) | Small safe values; the reference floor in min-out enforces the gap on chain |
| 2026-11-25 | Refills are planned so the worst fair payout stays under `maxPerRefill` (plan ≤ max × 10000 / (10000 + buffer + gap + 10)); in-flight refills count at that upper bound | Otherwise a capped refill always fails INV-3 |
| 2026-11-25 | Executor mode: `dry` by default (checks + `eth_simulateV1`, logs `dry_run`, sends nothing). `live` only when the owner sets `EXECUTOR_MODE=live` | Rollout steps 2 and 4 (CLAUDE.md §6) |
| 2026-11-25 | Sending: the spender is a CDP smart account; refills go out as one ERC-4337 user operation (`sendUserOperation`, idempotency key = refill id). The refill moves to `sent` BEFORE the send call; the user-op hash is saved right after; a `sent` refill with no hash stays locked for a manual check | No double send after a crash; fail closed |
| 2026-11-25 | Controls (global pause, Stop, agent pause, permission status) are read again right before sending | INV-7 between simulate and send |
| 2026-11-25 | A confirmed user op whose receipt shows no USDC reaching the agent wallet is marked `failed` (`tx_failed`) | Never record a refill that didn't arrive |
| 2026-11-25 | The same wait/block reason for an agent is logged at most once an hour; new code `dry_run` (retryable) | Keeps receipts readable on weekends (stale feed every tick) |
| 2026-11-25 | Lab #1–7: decision-level tests with a fake chain (`test/executor`), batch behaviour on real Base state with the real CDP spender (`test/fork/executor.fork.test.js`: happy, min-out revert, revoked, allowance, destination) | B20 needs `eth_simulateV1`; full executor + fake chain keeps tests fast and offline |
| 2026-11-25 | Checkpoint B fixes: live mode only for accounts in `LIVE_USER_ADDRESSES` (others run dry) with a per-refill cap `LIVE_MAX_REFILL_USDC` (default $1), checked again right before send; chain time read fresh per agent and for the swap deadline; agent and user re-read under the lock; token decimals read on chain each tick (mismatch = no sales); CDP idempotency key is a UUID v4 derived from the refill id; settle reads our own `UserOperationEvent` success flag and counts only pool → agent USDC; "included but no USDC seen" or "op not in receipt" stays locked with an alert; a send whose hash can't be saved is logged and alerted | Fresh-eyes review findings 1–7 |
| 2026-11-25 | Deferred to Checkpoint C: accept only Coinbase Smart Wallet / known 7702 accounts as permission signers (any ERC-1271 contract can burn spender gas); alert after 3 `simulation_failed`; owner alert channel for `alert: true` | Review findings 8–9; low risk at rollout step 4 (owner only) |
| 2026-11-25 | Refill size also fits the permission allowance left today (shrinks instead of blocking; below $0.10 → `allowance_exhausted`). The rollout cap (`LIVE_MAX_REFILL_USDC`, default $1) applies to dry runs too, so a dry run shows exactly what live would do | Owner's first dry run: planned ~$1.97 needed 0.0134 NVDAc > 0.01/day allowance → blocked |
| 2026-11-25 | Idempotent refill id = agent + 5-minute window + mode, so a dry-run record never takes the id a live run needs; a same-window repeat is skipped with a clear reason | Owner's first live tick ran in the same window as the dry run → `refill_in_flight`, nothing sent (checked on chain) |
| 2026-11-25 | Price guard accepts a reference up to 30 s newer than our block-time read (age = 0); more than that is still `price_stale` | Owner's live tick: "reference time is in the future". Measured on chain: the feed is normally 40–50 s behind the latest block, so the skew came from the RPC answering the feed read from a newer block than the time read. The owner's PC clock is not used |
| 2026-11-25 | Phase 3 acceptance met: first real refill on Base mainnet, tx `0x576245f2149007aeafc3fdc32efd2982d6fd24ae1cca4e4e72b470d75aa58655` (0.00665098 NVDAc → 0.988785 USDC, min-out 0.983841, one ERC-4337 user op that also deployed the spender) | Evidence for Option A on mainnet |
| 2026-11-25 | Scout: an EOA with its own key (`SCOUT_PRIVATE_KEY`, scout/.env only), pays `market-pulse` ($0.03) via x402 v2 `exact` on Base USDC. Guards: Base USDC only, ≤ $0.10 per call, daily budget (default $0.30, `SCOUT_DAILY_MAX_USDC`), cost reserved before paying, unclear outcomes keep the cost reserved. `dry` by default; `SCOUT_MODE=live` to pay. Writes runs straight to `scoutRuns` | Smallest real agent; x402 `exact` needs no ETH in the payer |
| 2026-11-25 | `/v1/proof` shows Scout runs and the refills of the agent whose wallet = `SCOUT_ADDRESS` (public address in server env); no user ids; balance "unavailable" when the chain read fails | FR-PRF-001; only our own agent is public |
| 2026-11-25 | Each tick refills agents in order of need: biggest USDC gap below the floor first, unreadable balances last, ties in DB order. The order only; every decision still reads the balance fresh | Owner's agents share one Spend Permission allowance; a $0 agent was starved by one just under its floor (tx `0x062d974c…c815`) |
| 2026-11-25 | Rate limits are in memory, per IP, per minute: `/v1/auth` 20, writes on `/v1/*` 30, `/v1/proof` 60, `/internal` 10. New error code `rate_limited` (429, retryable, `Retry-After` header) | One API instance on Render; no extra service needed (§12 security) |
| 2026-11-25 | First real Scout x402 payment: tx `0x57a8130e63de6c5ddd17daa51af113819cc8a2524f9455d4a8e912ef660cf3db` (0.03 USDC to x402stock, HTTP 200). Funded by a manual 0.1 USDC transfer because the day's permission allowance was used; the first Holdtil refill of Scout follows on 2026-11-26 | Owner chose not to wait a day |
| 2026-11-25 | Keep-alive: `GET /health` pings MongoDB; cron-job.org calls it every 10 min (plus the 5-min tick). API responses send `Cache-Control: no-store`; `TRUST_PROXY_HOPS=2` behind Vercel + Render | Atlas free clusters pause after inactivity (owner); Vercel external rewrites cache by default and set `x-forwarded-for` to the client IP (vercel.com/docs/routing/rewrites, /headers/request-headers) |
| 2026-11-25 | Scout runs 24/7 from GitHub Actions, hourly (`.github/workflows/scout.yml`); key and Mongo URI as repo secrets, `SCOUT_MODE` as a repo variable. Returns `budget_reached` once the daily budget can't cover a call | Owner's choice: free, separate from the Holdtil server; Scout's own guards still cap spend |
| 2026-11-25 | Tagline is now "Your agent's **budget** stays invested until it pays." (was "money") | More exact: the stock sits in the owner's Base Account and the agent wallet only holds a small USDC float. Owner approved in the build thread |
| 2026-11-25 | Base Builder Code (ERC-8021) on every refill user op via CDP `sendUserOperation({ dataSuffix })`; the simulation uses the same suffixed calldata. Code comes from `BUILDER_CODE` (public; from Base Dashboard). Empty = no tag; malformed = server won't start. Not on Scout's x402 payments: those are signed authorizations that the facilitator submits, so we don't control their calldata | docs.base.org/apps/builder-codes/app-developers; fork test: suffix adds 458 gas, same USDC to agent; suffix matches the docs example byte for byte |
| 2026-11-25 | FR-FPC-001 fair-price check on Bankr x402 Cloud, $0.01 USDC per call. Code lives in `bankr/`; the price rule files are exact copies of `server/src/core` (a test fails on drift; `npm run bankr:sync` copies). Bad input answers 400 and chain failure 503, so the caller is not charged; `wait` answers 200 (a paid, correct answer). The handler records each answer at `POST /internal/checks` (`CHECK_SECRET` in Bankr env + Render); a failed record never changes the answer. `/proof` shows answered checks and links the payout wallet on BaseScan for the actual payments (settlement happens at Bankr after the answer, so we don't claim a tx per check). The owner deploys with the Bankr CLI | Bankr docs: x402-cloud reference (settles only on status < 400; payer in `x-402-payer`; imports must stay inside the service folder) |
| 2026-11-26 | FR-BKS-001 Holdtil skill for Bankr agents (`bankr/skills/holdtil/`, Bankr SKILL.md + catalog.json format). The fair-price answer adds `sell.fairFloorUsdc` = Chainlink value of `stockAmount` − `maxGapBps`: the floor for any route after its fees (Bankr's swap routes B20 through its bridge/swap aggregator and charges a fee, so the Aerodrome-specific `minUsdcOut` would wrongly block it). Bankr chat swaps take slippage, not a min-out, so the skill sets `slippage = (expected − fairFloor)/expected`. Refills are on demand ("holdtil refill"); Bankr scheduled commands need Club and decline trades under $10, so no schedule in the MVP. Owner sets Bankr Security limits as the hard cap. Risk: if Bankr's fee + gap exceed 1%, the skill always waits (measured in the owner test) | Bankr docs: token-trading, tokenized-stocks (B20 needs location check), wallet-api/swap (B20 via aggregator, `feeBps`), automation (Club, $10 min), skills format. Live check 2026-11-26 (US holiday): `wait`, `price_stale`, reference 43,630 s old |
---

## 17. Real vs mocked

| Part | Real or mocked | How the UI shows it |
|---|---|---|
| Sign in, permissions, refills, receipts | Real, Base mainnet | `REAL · BASE MAINNET` banner |
| Holdtil Scout payments | Real, Base mainnet | Shown on `/proof` with tx links |
| Fork tests | Local mainnet fork, fake money | Tests only; never shown as product data |

No mocked data in the product. If a value can't be read, the UI shows "unavailable". `REAL_VS_MOCKED.md` copies this table.

---

## 18. Break-it lab (H)

Shown in the video and covered by tests (fork) and, where safe, by real logged decisions:

| # | Attack / failure | Expected response |
|---|---|---|
| 1 | Pool price far from reference (earnings spike / weekend gap) | `price_gap_too_wide`, decision logged, no tx |
| 2 | Reference price stale (market closed, feed not updated) | `price_stale`, no tx |
| 3 | Refill over daily limit | `limit_exceeded`, no tx |
| 4 | Two ticks at the same moment | exactly one refill; other gets `refill_in_flight` |
| 5 | Permission revoked in wallet | `permission_revoked`, no tx |
| 6 | Owner presses Stop | `paused`, no tx |
| 7 | Request tries to change the destination address | rejected; INV-5 holds |

---

## 19. Live scenario and success measures

No seeded demo. The live proof is **Holdtil Scout** running on mainnet from Phase 4 until the deadline.

| Measure | Target |
|---|---|
| Logged-out visitor sees real proof on `/proof` | ≤ 60 s |
| Real refills confirmed on mainnet | ≥ 1 per day once live |
| Lab attacks blocked in tests | 7/7 |
| Real signups (not counting owner) | [ ] — report only real numbers |

---

## 20. Test plan

- **Core unit tests:** price guard (fresh/stale, gap edges), limits (every limit, day rollover), planner math in base units, state machine (all legal + illegal transitions).
- **Concurrency test:** two parallel ticks → one refill (INV-4).
- **Fork tests (Base mainnet state via `eth_simulateV1`; Anvil cannot run B20 — §16):** full refill batch; revoked permission; min-out revert; wrong destination rejected.
- **API tests:** auth nonce/verify/replay; validation; ownership (user A can't touch user B's agent).
- **Manual checks:** first real refill with owner approval; Scout run; 390px screens.
- Test counts are reported only after they pass.

---

## 21. Product surfaces — 6 screens

1. **Landing `/`** — what it is, how it works, risks, "Sign in with Base".
2. **Onboarding `/start`** — not-US + terms, then add first agent, then grant permission.
3. **Dashboard `/app`** — agents with float bars, permission allowance left, today's spend, Stop all.
4. **Agent `/app/agents/:id`** — settings, receipts and decisions list.
5. **Connect guide `/docs`** — how to point any agent wallet at Holdtil (zero integration).
6. **Proof `/proof`** — public Scout live data.

Persistent banner: `REAL · BASE MAINNET`.

---

## 22. Demo script (H) — 4 minutes

| Time | Act | On screen | Line |
|---|---|---|---|
| 0:00–0:30 | Dangerous default | Idle USDC + NVDAc earnings spike chart | "Agents pay their own bills now. Their money sits idle — and selling stock at the wrong moment is costly." |
| 0:30–1:20 | New way | Sign in, add agent, grant permission | "Hold stocks. Set limits. Holdtil handles the rest." |
| 1:20–2:10 | Real action | Scout pays x402stock; refill receipt + BaseScan | "Real data, real payment, real refill — on mainnet." |
| 2:10–3:20 | Break it | Waited / blocked decisions + tests | "Price off? It waits. Over limit? Blocked." |
| 3:10–3:20 | Holdtil on Bankr | In Bankr chat: "holdtil refill" → the agent pays Holdtil $0.01, gets `wait` (market closed) or `sell`, then swaps NVDAc → USDC with Bankr's swap at or above the fair floor; /proof lists the check | "Any agent on Bankr gets the same rule." |
| 3:20–3:50 | Control returns | Stop all agents → next tick paused | "One tap and it stops." |
| 3:50–4:00 | Close | Logo + holdtil.xyz | Positioning line (§25) |

Record each act the moment it works.

---

## 23. Judge experience (H)

- **First 10 s:** "Your agent's budget stays invested until it pays." + live proof numbers.
- **First 60 s:** open `/proof` → real Scout payments and refills with BaseScan links.
- **First 5 min:** video, README, `REAL_VS_MOCKED.md`, test results, code.

**60-second judge path (goes in README):**
1. Open `/proof` (no login).
2. Click any refill → BaseScan.
3. Scroll to "Waited" decisions to see the guard working.
4. Watch the video's "Break it" act.

---

## 24. Rubric → evidence (H)

Judging criteria are not published yet ([ ] update when known).

| Criterion | Evidence |
|---|---|
| Technical | Core tests, fork tests, mainnet tx hashes |
| Use of Base / tokenized stocks | §15 table, live refills selling NVDAc |
| Innovation | Spending side of agent treasuries; fair-price refill rule |
| Usefulness | Real signups, Scout running live, zero-integration setup |

---

## 25. Positioning and judge Q&A (H)

**Positioning statement:**
> Base has agents that pay with x402 and stocks you can hold onchain. Holdtil connects them: an agent's money stays in stocks and is sold only at fair prices, only within the owner's limits, only when the agent needs to pay.

**Prepared answers:**
- *How is this different from Leash?* Leash manages a portfolio. Holdtil funds an agent's spending. They could work together.
- *What's real?* Everything in the product, on mainnet (§17).
- *What stops a bad sale?* Fresh reference + max gap + limits + simulation + min-out (§11).
- *Can Holdtil steal funds?* It can only use the Spend Permission the user signed, only up to its allowance, and only to send USDC to the user's own agent wallet.
- *What about when stocks fall?* Holding stocks is the owner's choice and they can go down. Holdtil only manages how and when they're sold.
- *What didn't you finish?* [honest answer + ROADMAP]

**Innovation note:** we combine known parts (Spend Permissions, Chainlink feeds, DEX swaps, x402). The originality is the loop that keeps an agent's treasury invested until the exact moment it pays.

---

## 26. Scope control

**P0 — must ship:** FR-AUTH-*, FR-AGT-001, FR-PRM-*, FR-RFL-*, FR-RCP-001, FR-CTL-001, FR-SCT-001, FR-PRF-001, FR-FPC-001, FR-BKS-001, FR-LND-001.
**P1 — only after P0 is live AND recorded:** FR-RSV-001, FR-STK-001, FR-ALR-001.
**Never in this build (→ ROADMAP.md):** rebalancing, lending/leverage, own token, US users, mobile app, multi-chain.

---

## 27. Build order and phases

Phases run back to back. An agent stops only for: a manual task, missing env values, deployment (owner deploys), or the first real-money transaction of a feature. Each stop leaves a simple step-by-step guide (CLAUDE.md §10).

### Phase 0 — Foundation + Gate 0 (target: Nov 25–26)
- **Goal:** Repo runs; all 6 Gate 0 premises proven or Option B chosen.
- **Scope:** monorepo (`client/`, `server/`, `scout/`), lint/test/verify scripts, env example files, `addresses.js` with official sources, Gate 0 scripts under `server/scripts/gate0/` on an Anvil mainnet fork.
- **Acceptance:** `npm run verify` passes; Gate 0 results with raw evidence in §16.
- **Tests:** fork scripts for premises 1–4 (B20 parts via `eth_simulateV1`, see §16); x402 dry check for 5.
- **Manual stops:** GitHub repo, MongoDB Atlas, CDP account + keys, RPC URL, owner wallet funding, eligibility check, Stocks Maxxing application.
- **Review:** — (Opus review of Gate 0 result)

### Phase 1 — Core engine (target: Nov 27–28)
- **Goal:** Pure rules for price guard, limits, planner, state machine.
- **Scope:** `server/src/core/*` + tests; read-only adapters for balances, reference price, quote.
- **Acceptance:** all core + concurrency tests pass; read-only script prints real mainnet balances and prices.
- **Review:** Checkpoint A.

### Phase 2 — Accounts, agents, permissions (target: Nov 29–Dec 1)
- **Goal:** Real users can sign in, onboard, add agents, grant and see permissions.
- **Scope:** auth, onboarding, agents CRUD, permissions grant + status, dashboard (read-only), Bootstrap UI at 390px.
- **Acceptance:** API tests pass; owner can sign in and grant a permission on mainnet (signing only, no spend).

### Phase 3 — Refill executor (target: Dec 2–4)
- **Goal:** Real refills with receipts and all guards.
- **Scope:** tick endpoint, executor (simulate → batch send → confirm), receipts, waits/blocks, Stop/pause, global pause. Rollout: dry run → fork → owner-approved $1 mainnet refill.
- **Acceptance:** fork tests for lab #1–7 pass; one real refill confirmed on mainnet with receipt.
- **Record:** Act 3 (refill part), Act 4, Act 5.
- **Review:** Checkpoint B.

### Phase 4 — Holdtil Scout + proof page (target: Dec 5–6)
- **Goal:** Our agent runs live on mainnet; public proof.
- **Scope:** `scout/` x402 client paying x402stock.xyz, schedule, summaries; `/proof` page.
- **Acceptance:** Scout's real payments and Holdtil refills appear on `/proof` with BaseScan links.
- **Record:** Act 3 (full).

### Phase 5 — Product polish + launch (target: Dec 7–9)
- **Goal:** Ready for real users.
- **Scope:** landing, `/docs` connect guide, notices, empty/error states, rate limits, README, REAL_VS_MOCKED, security review.
- **Acceptance:** §30 checklist except video/submission; independent security review done.
- **Review:** Checkpoint C (before inviting real users).

### Phase 6 — Video, X post, submission (target: Dec 10–11 12:00 WAT)
- **Goal:** Submitted before internal cutoff.
- **Scope:** video, X post from @Ayyoweb3 tagging @buildonbase, submission form, @holdtil repost.

### Phase 7 — P1 extras (only if everything above is done)

---

## 28. Deadline plan (H)

| Date | Work | Gate |
|---|---|---|
| Nov 24–26 | Phase 0 + apply to Stocks Maxxing | Gate 0 result |
| Nov 27–28 | Phase 1 | Checkpoint A |
| Nov 29–Dec 1 | Phase 2 | Permission signed on mainnet |
| Dec 2–4 | Phase 3 | First real refill |
| Dec 5 | Application form closes (11:59pm EST) | Applied |
| Dec 5–6 | Phase 4 | Scout live |
| Dec 7–9 | Phase 5 | Launch to real users |
| Dec 10–11 12:00 WAT | Phase 6 | Submitted |

- **After the internal cutoff:** fixes only. **After the deadline:** keep it live; no feature commits.

---

## 29. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Spend Permissions don't work on B20 tokens | Critical | Gate 0 #1; Option B executor contract |
| Owner can't hold NVDAc from Nigeria | Critical | Gate 0 #6 on day 1; ask in partner Telegram |
| Thin liquidity → bad quotes on tiny sales | High | Gap guard + min-out; batch refills |
| Bug moves real money wrongly | Critical | Non-custodial; INV-5 destination lock; fork tests; $1 limits first; independent review |
| Render free tier sleeps | Medium | cron-job.org pings `/internal/tick` every 5 min |
| Budget ($10) runs out | Medium | Tiny amounts; free tiers; no LLM required |
| Rules or judging criteria change | Medium | Watch Base page + partner Telegram |
| Owner's wallet can't sign spend permissions (CDP docs: "Spend Permissions in Coinbase Wallet (formerly Base App) are coming soon") | Critical | Check in Phase 2 which wallet holds the owner's NVDAc; Base Account (keys.coinbase.com) path first; Option B executor if needed |
| NVDAc pool is small (~$18.7k USDC side) | Medium | Gap guard + min-out; small refills |

---

## 30. Definition of finished

- [ ] A real user (not the owner) can sign up and complete the core flow.
- [ ] Real refills confirmed on mainnet, with receipts.
- [ ] Every lab item in §18 blocked in tests.
- [ ] Every invariant in §11 has a passing test.
- [ ] Clean clone → install → verify passes.
- [ ] `/proof` shows live real data.
- [ ] Video shows every act; the real refill is uncut.
- [ ] §17, REAL_VS_MOCKED.md, UI banner, README and submission agree; every number matches.
- [ ] PROJECT_STATE.md is current.

---

## 31. Submission fields and deliverables (H)

| Field | Answer / source |
|---|---|
| Overview | §1 |
| Problem | §3 |
| How it works | §9, §13 |
| Base use | §15 |
| What was built during the program | Everything (new repo started 2026-11-24) |
| What's real | §17 |
| X post | public video demo tagging @buildonbase, from @Ayyoweb3 |
| Repo / Live / Video | [links] |

---

## 32. Future story

- **Roadmap:** USDC reserve fallback; more stocks; alerts; SDK for agent frameworks.
- **Why others will need this:** every agent that earns or spends on Base needs somewhere to keep its money between payments.

---

## 33. Open questions

| # | Question | Owner | Decide by |
|---|---|---|---|
| 1 | Can the owner hold NVDAc from Nigeria? **Yes — bought on Aerodrome 2026-11-24** | Adesope | done |
| 2 | Is @holdtil free on X? | Adesope | Nov 25 |
| 3 | Can one project enter two tracks? | Adesope (partner Telegram) | Dec 5 |
| 4 | Default limits for new users (floor, target, daily). **Set in Phase 2: $1 / $3 / $2 per refill / $5 a day per agent, $10 per user (§16)** | Adesope + Claude | done |
| 5 | Exact deadline time on Dec 12 | Adesope (partner Telegram) | Dec 1 |
| 6 | Which wallet holds your NVDAc? **Answer 2026-11-24: a plain EOA (no code, nonce 1648, holds 0.00685353 NVDAc).** An EOA can't grant Spend Permissions, which need a Coinbase Smart Wallet / Base Account. Plan: owner opens a Base Account and moves NVDAc there before the Phase 2 signing stop | Adesope | Phase 2 |
