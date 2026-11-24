# PROJECT_STATE — Holdtil

> Where the project actually stands. A progress log, not requirements (those live in `PRD.md`).
> Update at the end of every phase. Only write what was verified. If this file and the repo disagree, the repo wins.

**Last updated:** 2026-11-24 19:00 WAT · **By:** Claude · **Commit:** see §2 / §10

---

## 1. Right now

- **Active phase:** Phase 1 — Core engine: done. **Checkpoint A** review done and all findings fixed.
- **Status:** Stopped at Checkpoint A (CLAUDE.md §10 item 4) for the owner.
- **Next step:** Owner says "go" → Claude starts Phase 2 (accounts, agents, permissions).
- **Blocked by:** owner go-ahead after Checkpoint A. M9 done. M10 (Base Account with NVDAc) needed before the end of Phase 2.

**Checkpoint A — what you need to do**
- *What and why:* CLAUDE.md §12 asks for a fresh-eyes review after the core engine, and §10 says to stop there for you.
- *Steps:*
  1. Read the review result in §10 (build log) or the chat summary.
  2. Reply "go" in the Holdtil thread to start Phase 2. Or name anything you want changed first.
  3. Also answer PRD §33 Q6: which wallet holds your NVDAc (Base Account / Coinbase Wallet app / other)?
- *Env vars:* none needed for Phase 2 in the cloud build (tests use in-memory MongoDB).
- *How to check it worked:* the thread shows Phase 2 starting.
- *What happens next:* Phase 2 builds Sign in with Base, onboarding, agents and permission signing. It ends with a stop for you to sign a real spend permission on mainnet (signing only, no spend).

**M9 — Register a CDP Wallet Secret for the dev project**
- *What and why:* Creating Holdtil's spender account failed with CDP's message "Project has no secret. Please register a secret with the project." The spender is the account that sends refills. Without it, Phase 3 can't run.
- *Steps:*
  1. Open portal.cdp.coinbase.com and pick the **holdtil-dev** project (top-left project switcher).
  2. In the left menu open **Server Wallet** (sometimes under "Wallets" → "Server Wallet").
  3. Find **Wallet Secret** and click **Generate** (or "Create secret"). Copy it once; CDP shows it only once.
  4. Make sure your API key (CDP_API_KEY_ID / CDP_API_KEY_SECRET) is from the **same** holdtil-dev project. If not, create a new Secret API key there too.
  5. In claude.ai/code → environment selector → settings icon → Environment variables, set `CDP_WALLET_SECRET` to the new value (and the API key vars if you made new ones). Never paste it in chat.
  6. Start a new session (env changes only reach new sessions).
- *How to check it worked:* run `npm run gate0`. The last step "CDP spender account" shows `ok: true` with two public addresses and `isCoinbaseSmartWalletV11: true`.
- *What happens next:* Claude records the dev spender's public address. You later send it a few cents of ETH for gas (separate guide in Phase 3).

## 2. Phase tracker

| Phase (PRD §27) | Status | Verified on | Commit | Review |
|---|---|---|---|---|
| 0 — Foundation + Gate 0 | Done | 2026-11-24 | `1115b8c` | Gate 0 reviewed by Opus (orchestrator); passed |
| 1 — Core engine | Done | 2026-11-24 | `91ab9a5` + review fixes (see §10) | A done; 9 findings fixed or carried to Phase 3 |
| 2 — Accounts, agents, permissions | Not started | | | — |
| 3 — Refill executor | Not started | | | B |
| 4 — Holdtil Scout + proof page | Not started | | | — |
| 5 — Product polish + launch | Not started | | | C |
| 6 — Video, X post, submission | Not started | | | — |
| 7 — P1 extras | Not started | | | — |

## 3. Last verification

| Check | Command | Result | Date |
|---|---|---|---|
| Full gate | `npm run verify` | pass (exit 0): lint 0 warnings, 69 server tests, scout 0 tests, client build ok | 2026-11-24 |
| Tests | `npm test` | 69 passed (10 files), incl. 10 DB tests on in-memory MongoDB | 2026-11-24 |
| Fork tests | `npm run test:fork` | 8 passed (Gate 0 #1–#4 + read-only adapters on Base mainnet) | 2026-11-24 |
| Read-only script | `npm run read-only` | printed real block, NVDA reference $152.77 (age 115 s), quote 0.01 NVDAc → 1.527935 USDC, gap 2 bps, balances | 2026-11-24 |
| Gate 0 report | `npm run gate0` | #1–#5 pass; CDP spender step blocked (M9) | 2026-11-24 |
| UI at 390px | Playwright screenshot | shell renders, no horizontal scroll (390 and 1280) | 2026-11-24 |

## 4. What works (verified)

- Monorepo: `server/` (Express 5 + viem), `client/` (Vite + React 19 + Bootstrap 5), `scout/` (x402 client deps). `npm run verify` passes.
- `GET /health` returns `{status:"ok", network:"base-mainnet", chainId:8453}` (API test).
- `server/src/config/addresses.js` — every address with its official source; allowlist helper (INV-6) with tests.
- Structured error codes from PRD §11 (`server/src/errors.js`).
- Gate 0 scripts in `server/scripts/gate0/` and `scout/scripts/x402-dry-check.js` — all premises proven (PRD §16, report in `docs/gate0/`).
- Client shell: `REAL · BASE MAINNET` banner + notices. No sign-in yet.
- Core engine (pure, unit-tested): `core/priceGuard` (INV-2, fails closed), `core/limits` (INV-3 + UTC day spend), `core/refillPlanner` (size, stock amount, min-out with reference floor), `core/stateMachine` (legal/illegal transitions, history), `core/decide` (controls INV-7 → price → limits order).
- `db/refills.js`: INV-4 single flight via partial unique index + idempotent refill IDs + state-guarded updates. Proven by concurrency tests (2 and 20 parallel ticks → 1 refill).
- Read-only adapters: `chain/priceFeed`, `chain/balances`, `chain/quote` (allowlist-checked).

## 5. Real vs mocked right now

See `REAL_VS_MOCKED.md`. Product features not built yet. Gate 0 used real mainnet reads and simulations; no transaction was sent.

## 6. Live proof

| Item | Value |
|---|---|
| Live URL | none yet (holdtil.xyz planned) |
| Proof page | none yet |
| Network | Base mainnet (planned) |
| Contracts / addresses | none deployed |
| Real transactions | none yet (Gate 0 sent nothing) |

## 7. Demo recordings (PRD §22)

| Act | Recorded? | File / link | Date |
|---|---|---|---|
| 1 — Dangerous default | no | | |
| 2 — New way | no | | |
| 3 — Real action | no | | |
| 4 — Break it | no | | |
| 5 — Control returns | no | | |

## 8. Known issues and limitations

- Eligibility confirmed: owner bought and holds NVDAc from Nigeria (2026-11-24).
- Anvil can't run B20 precompiles; B20 tests use `eth_simulateV1` (PRD §16).
- CDP docs say spend permissions in the Coinbase Wallet app are "coming soon". We must confirm in Phase 2 that the owner's wallet (Base Account) can sign one (PRD §33 Q6).
- NVDAc/USDC pool is small (~18.7k USDC side). Fine for small refills.
- `npm audit`: 3 high-severity advisories inside `@coinbase/cdp-sdk`'s own nested `zod`/`abitype`. The only "fix" downgrades the SDK to 1.7.0. Left as is; re-check before launch (Checkpoint C).
- Dev spender created (M9 done): `0xb7F3c5F916359B303d3ecEbB39f47969444fd15B`. Owner's NVDAc is in a plain EOA; needs a Base Account (M10).

## 9. Handoff notes

- **Read first:** `CLAUDE.md`, PRD sections for the active phase, then this file.
- **Branch:** `claude/project-thread-uqb47q` (cloud session branch) · **Uncommitted work:** none after Phase 0 commit
- **Env vars needed (names only, final list set in Phase 0):** `BASE_RPC_URL`, `MONGODB_URI`, `SESSION_SECRET`, `TICK_SECRET`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` (all 6 set for dev on 2026-11-24); later: `MONGODB_URI` (Render only), `SCOUT_PRIVATE_KEY`
- **Watch out for:** real money — follow CLAUDE.md §6.

## 10. Build log

- **2026-11-24** — Project docs created (PRD, CLAUDE, PROJECT_STATE, ROADMAP, README, REAL_VS_MOCKED). Research and idea selection done in chat.
- **2026-11-24 — Phase 0 done.** Files: root `package.json` (workspaces + scripts), `eslint.config.js`, `.gitignore`, `server/` (app, config, errors, tests, Gate 0 scripts, fork tests), `client/` (shell), `scout/` (x402 dry check), `.env.example` ×3, `docs/gate0/2026-11-24-gate0-report.json`. Tests: verify pass, 17 unit/API, 2 fork. Tx hashes: none. Env changes: none (names documented in `.env.example`). Limits: CDP spender blocked (M9). Next: Phase 1. Commit `1115b8c`.
- **2026-11-24 — Phase 1 built.** Files: `server/src/core/*` (money, priceGuard, limits, refillPlanner, stateMachine, decide), `server/src/db/refills.js`, `server/src/chain/*` (abis, client, priceFeed, balances, quote), `server/scripts/read-only.js`, tests in `server/test/core`, `server/test/db`, `server/test/fork/adapters.test.js`. Tests: verify pass, 60 unit/API/DB, 7 fork. Tx hashes: none. Env changes: none. PRD §11/§14/§16 updated (INV-4 includes `checked`; refill capping; min-out reference floor). Next: Checkpoint A review. Commit `91ab9a5`.
- **2026-11-24 — Checkpoint A (fresh-eyes review, separate agent).** Findings: (1, critical, not live yet) `spentToday` skipped DB docs (Date/string shapes) → fixed, throws on unknown shapes, DB→core test added; (2) limits vs actual payout → `maxPayoutUsdc` added, PRD §16; (3) `minOut` input checks → added; (4) crash could lock an agent → `simulated→waited/blocked` + `recoverStaleRefills`; (5) price units / incomplete round → refused; (6) `moveRefill` field whitelist + bigint→string; (7) `quoteSell` allowlist; (8) missing tests → added; (9) Gate 0 sim lacks reference floor → carried to Phase 3. Tests after fixes: 69 unit/API/DB, 8 fork, verify pass.

## 11. Manual tasks (owner)

Status: ⬜ to do · ✅ done

| # | Task | Status |
|---|---|---|
| M1 | Apply to Stocks Maxxing (closes Dec 5, 11:59pm EST) | ⬜ |
| M2 | Check you can hold NVDAc from Nigeria | ✅ 2026-11-24 (bought ~$1 on Aerodrome) |
| M3 | Create the GitHub repo | ✅ 2026-11-24 |
| M4 | Create MongoDB Atlas free cluster | ⬜ |
| M5 | Create a Coinbase Developer Platform (CDP) account + API keys | ✅ 2026-11-24 (holdtil-dev project, Live, dev keys in cloud env) |
| M6 | Get a Base mainnet RPC URL | ✅ 2026-11-24 (public RPC for dev) |
| M7 | Check @holdtil on X and create it | ⬜ |
| M8 | Buy holdtil.xyz (can wait until Phase 5) | ⬜ |
| M9 | Register a CDP Wallet Secret in the holdtil-dev project (guide in §1) | ✅ 2026-11-24 — dev spender created: smart account `0xb7F3c5F916359B303d3ecEbB39f47969444fd15B` (owner `0x806af4E9023Ddd6d218CCF6c6362485F475224cB`), Coinbase Smart Wallet v1.1 confirmed, not deployed, 0 ETH |
| M10 | Create a Base Account (keys.coinbase.com) and move a few dollars of NVDAc into it. No ETH or USDC needed there | ⬜ |

**M1 — Apply to Stocks Maxxing**
1. Open the application form from base.org/stocksmaxxing ("Apply Now").
2. Project name: Holdtil. Track: Agentic Stock Finance. Entry type: Build New. Token: No. Stage: Idea.
3. Use the pitch text from PRD §1 / §25.
4. Check it worked: you get a confirmation screen or email.

**M2 — Can you hold NVDAc?**
1. Open your Base wallet (Base Account / Coinbase Wallet).
2. Search for NVDAc (Coinbase Tokenized Stock). Verify the address against base.org/stocks.
3. Try to buy $1 worth with USDC on Base (via the wallet or Aerodrome).
4. Check it worked: NVDAc shows in your wallet. If it's blocked, tell Claude the exact error.

**M3 — GitHub repo**
1. On GitHub, create a new **public** repo named `holdtil` under london160771. No README (we have one).
2. Check it worked: the repo page shows "Quick setup". Tell Claude it's ready; Claude will add it and push.

**M4 — MongoDB Atlas**
1. Sign in at cloud.mongodb.com → create a **free (M0)** cluster.
2. Database Access → add a user with a strong password. Network Access → allow `0.0.0.0/0` (needed for Render free tier).
3. Connect → Drivers → copy the connection string.
4. **Keep it for deploy.** It goes into Render's Environment settings when you deploy (Phase 5). The cloud build uses an in-memory test database, so it is not needed there.
5. Check it worked: after deploy, `/health` reports "db: ok".

**M5 — Coinbase Developer Platform**
1. Sign in at portal.cdp.coinbase.com → create a project.
2. API Keys → create a **Secret API key** → save the key ID and secret. Also create a **Wallet Secret** (Server Wallet).
3. Make **two** keys: a `dev` key for the cloud build and a `prod` key for Render later. Put the dev ones in the cloud environment variables (see "Where env values go" below) as `CDP_API_KEY_ID=`, `CDP_API_KEY_SECRET=`, `CDP_WALLET_SECRET=`. Never paste them in chat.
4. Check it worked: Claude's Gate 0 script will create the spender account and print only its public address.

**M6 — Base RPC URL**
1. Easiest: in the CDP portal, open Node → copy your Base mainnet RPC URL.
2. For the cloud build, the free public RPC is enough: `BASE_RPC_URL=https://mainnet.base.org` (no secret). Keep your CDP RPC URL for Render (prod).
3. Check it worked: Claude's script prints the latest Base block number.

**M7 — X account**
1. Check x.com/holdtil is free. If yes, create it with the same email you'll use for the project.
2. Bio: "Your agent's money stays invested until it pays. Built on @base."
3. Tell Claude the handle (or a backup handle if taken).

**M8 — Domain (later)**
1. Buy `holdtil.xyz` (~$1.49 first year) on Vercel Domains or another registrar.
2. In Phase 5 Claude will give you a short guide to point it at the Vercel project.

### Where env values go

| Where | What goes there | Who can see it |
|---|---|---|
| Claude Code cloud environment → Environment variables (claude.ai/code → environment selector → settings icon) | **Dev values only**: `BASE_RPC_URL=https://mainnet.base.org`, dev CDP keys, `SESSION_SECRET`/`TICK_SECRET` (random dev values) | You, and any session in that environment. Keep the environment personal (don't share it). |
| Claude Code cloud environment → Network access | Custom: `mainnet.base.org`, `api.cdp.coinbase.com`, `x402stock.xyz` (+ tick "include default list") | — |
| Render → service → Environment | **Prod values**: prod `MONGODB_URI`, prod CDP keys, CDP RPC URL, prod secrets | You only |
| Vercel → project → Environment Variables | Only public `VITE_` values (API URL). Never secrets. | Public (ships to browsers) |

Rules: prod keys never go into the cloud build environment. Dev spender wallet holds a few cents of ETH only. Env changes reach a running session only after it restarts or in a new session.
