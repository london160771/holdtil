# PROJECT_STATE — Holdtil

> Where the project actually stands. A progress log, not requirements (those live in `PRD.md`).
> Update at the end of every phase. Only write what was verified. If this file and the repo disagree, the repo wins.

**Last updated:** 2026-11-24 23:30 WAT · **By:** Claude · **Commit:** see §2 / §10

---

## 1. Right now

- **Active phase:** Phase 2 — Accounts, agents, permissions: built and verified in the cloud.
- **Status:** Stopped (CLAUDE.md §10 items 1 and 3): the first real mainnet signature of a new feature needs the owner.
- **Next step:** Owner runs the app and signs in + signs one real spend permission (signing only, nothing is spent). Then Claude starts Phase 3.
- **Blocked by:** owner test of sign-in + spend permission on mainnet (P2-STOP below).

**P2-STOP — sign in and sign a real spend permission (no money moves)**
- *What and why:* Phase 2 is done in tests. Two things can only be proven with your real wallet: (a) Sign in with Base works for your smart wallet `0x406b…4c56` (it is an EIP-7702 account, so the server has a fallback check), and (b) your wallet shows and signs a spend permission request (PRD §33 Q6). Signing moves no money. Holdtil cannot spend yet: there is no refill code until Phase 3.
- *Steps (run it on your own computer, about 15 minutes):*
  1. Make a free dev database: go to cloud.mongodb.com → sign up → create a free **M0** cluster named `holdtil-dev` → Database Access: add a user with a password → Network Access: "Add current IP" → Connect → Drivers → copy the connection string. This is a **dev** database, never the prod one.
  2. Install Node 22+ (nodejs.org) and Git if you don't have them.
  3. In a terminal: `git clone https://github.com/london160771/holdtil && cd holdtil && git checkout claude/project-thread-uqb47q && npm install`
  4. Copy `server/.env.example` to `server/.env` and fill in these names in that file (never in chat): `MONGODB_URI` (your connection string, add `/holdtil` before the `?`), `SESSION_SECRET` and `TICK_SECRET` (any long random text, e.g. from `openssl rand -hex 32`), `APP_ORIGIN=http://localhost:5173`, `SPENDER_ADDRESS` (already filled), `BASE_RPC_URL=https://mainnet.base.org`. CDP keys are not needed for this step.
  5. Run `npm run dev` and open http://localhost:5173 in your browser.
  6. Click **Sign in with Base**. In the popup, use the smart wallet `0x406b…4c56` (keys.coinbase.com).
  7. Tick both boxes → Continue. Add an agent: any name, and an agent wallet you control that is **not** the smart wallet (your EOA `0xbabd…7589` is fine). Leave limits empty (defaults).
  8. In "Sign a spend permission" keep **NVDAc** and **0.01** per day → **Sign spend permission** → approve in the popup.
- *How to check it worked:* the dashboard shows your agent, and under "Spend permissions" one row: NVDAc, per day 0.01, left today 0.01, status `active` (read live from chain). If any step shows an error, copy the red error text (not any secret) into the thread.
- *What happens next:* Claude records the result (PRD §33 Q6, M10) and starts Phase 3 (refill executor: dry run first, then fork tests). The first real refill will be another stop for your approval.
- *Alternative if you can't run it locally:* deploy (you deploy; Phase 5 has the full guide). Ask in the thread.

## 2. Phase tracker

| Phase (PRD §27) | Status | Verified on | Commit | Review |
|---|---|---|---|---|
| 0 — Foundation + Gate 0 | Done | 2026-11-24 | `1115b8c` | Gate 0 reviewed by Opus (orchestrator); passed |
| 1 — Core engine | Done | 2026-11-24 | `91ab9a5` + review fixes (see §10) | A done; 9 findings fixed or carried to Phase 3 |
| 2 — Accounts, agents, permissions | Built; owner mainnet check pending (P2-STOP) | 2026-11-24 | see §10 | — |
| 3 — Refill executor | Not started | | | B |
| 4 — Holdtil Scout + proof page | Not started | | | — |
| 5 — Product polish + launch | Not started | | | C |
| 6 — Video, X post, submission | Not started | | | — |
| 7 — P1 extras | Not started | | | — |

## 3. Last verification

| Check | Command | Result | Date |
|---|---|---|---|
| Full gate | `npm run verify` | pass (exit 0): lint 0 warnings, 114 server tests (13 files), scout 0 tests, client build ok | 2026-11-24 |
| Fork tests | `npm run test:fork` | 11 passed (3 files): Gate 0, read-only adapters, smart-wallet (ERC-6492) SIWE + permission signatures | 2026-11-24 |
| Server smoke | real `src/index.js` + in-memory MongoDB + mainnet RPC | `/health` ok; SIWE sign-in with a throwaway key → 200 + session cookie; `/v1/me` ok; replayed sign-in → 401 `auth_failed` | 2026-11-24 |
| UI | Playwright screenshots, API mocked for layout only | landing, start, dashboard, agent at 1280 and 390: no horizontal scroll | 2026-11-24 |
| Real wallet | owner sign-in + spend permission | **not done yet** (P2-STOP) | — |

## 4. What works (verified)

- Monorepo: `server/` (Express 5 + viem), `client/` (Vite + React 19 + Bootstrap 5), `scout/` (x402 client deps). `npm run verify` passes.
- `GET /health` returns `{status:"ok", network:"base-mainnet", chainId:8453}` (API test).
- `server/src/config/addresses.js` — every address with its official source; allowlist helper (INV-6) with tests.
- Structured error codes from PRD §11 (`server/src/errors.js`).
- Gate 0 scripts in `server/scripts/gate0/` and `scout/scripts/x402-dry-check.js` — all premises proven (PRD §16, report in `docs/gate0/`).
- Client: `REAL · BASE MAINNET` banner + notices on every page. Pages `/`, `/start`, `/app`, `/app/agents/:id` (PRD §21). Sign in with Base + spend permission signing via `@base-org/account` (not yet tried with a real wallet).
- Phase 2 API (PRD §14), all covered by API tests on in-memory MongoDB: SIWE nonce/verify/logout with one-use nonces and hashed session tokens; onboarding (not-US + terms); me, stop, resume; agents add/list/get/edit/pause with limit validation, hard caps and ownership (other users get 404); spend permissions saved only after the signature checks out for that account, with live status and allowance left read from chain ("unavailable" if the read fails).
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
- CDP docs say spend permissions in the Coinbase Wallet app are "coming soon". Still to confirm with the owner's real wallet at P2-STOP (PRD §33 Q6).
- NVDAc/USDC pool is small (~18.7k USDC side). Fine for small refills.
- `npm audit`: 3 high-severity advisories inside `@coinbase/cdp-sdk`'s own nested `zod`/`abitype`. The only "fix" downgrades the SDK to 1.7.0. Left as is; re-check before launch (Checkpoint C).
- Dev spender created (M9 done): `0xb7F3c5F916359B303d3ecEbB39f47969444fd15B`. Owner's Base Account `0x406b…4c56` funded with NVDAc (M10 done).
- The owner's smart wallet is an EIP-7702 account. Sign in falls back to plain signature recovery when the address has 7702 code (PRD §16). Not yet tried with the real wallet.
- Same-origin hosting (Vercel rewrite of `/v1` to Render) is needed for the session cookie in production. Not written yet; Phase 5 deploy guide.

## 9. Handoff notes

- **Read first:** `CLAUDE.md`, PRD sections for the active phase, then this file.
- **Branch:** `claude/project-thread-uqb47q` (cloud session branch) · **Uncommitted work:** none after the Phase 2 commit
- **Env vars needed (names only):** `BASE_RPC_URL`, `SESSION_SECRET`, `TICK_SECRET`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` (all 6 set for dev on 2026-11-24). Server also needs `MONGODB_URI`, `APP_ORIGIN`, `SPENDER_ADDRESS` (from Phase 2; the server refuses to start without them; `npm run dev` reads `server/.env`). Later: `SCOUT_PRIVATE_KEY`.
- **Watch out for:** real money — follow CLAUDE.md §6.

## 10. Build log

- **2026-11-24** — Project docs created (PRD, CLAUDE, PROJECT_STATE, ROADMAP, README, REAL_VS_MOCKED). Research and idea selection done in chat.
- **2026-11-24 — Phase 0 done.** Files: root `package.json` (workspaces + scripts), `eslint.config.js`, `.gitignore`, `server/` (app, config, errors, tests, Gate 0 scripts, fork tests), `client/` (shell), `scout/` (x402 dry check), `.env.example` ×3, `docs/gate0/2026-11-24-gate0-report.json`. Tests: verify pass, 17 unit/API, 2 fork. Tx hashes: none. Env changes: none (names documented in `.env.example`). Limits: CDP spender blocked (M9). Next: Phase 1. Commit `1115b8c`.
- **2026-11-24 — Phase 1 built.** Files: `server/src/core/*` (money, priceGuard, limits, refillPlanner, stateMachine, decide), `server/src/db/refills.js`, `server/src/chain/*` (abis, client, priceFeed, balances, quote), `server/scripts/read-only.js`, tests in `server/test/core`, `server/test/db`, `server/test/fork/adapters.test.js`. Tests: verify pass, 60 unit/API/DB, 7 fork. Tx hashes: none. Env changes: none. PRD §11/§14/§16 updated (INV-4 includes `checked`; refill capping; min-out reference floor). Next: Checkpoint A review. Commit `91ab9a5`.
- **2026-11-24 — Checkpoint A (fresh-eyes review, separate agent).** Findings: (1, critical, not live yet) `spentToday` skipped DB docs (Date/string shapes) → fixed, throws on unknown shapes, DB→core test added; (2) limits vs actual payout → `maxPayoutUsdc` added, PRD §16; (3) `minOut` input checks → added; (4) crash could lock an agent → `simulated→waited/blocked` + `recoverStaleRefills`; (5) price units / incomplete round → refused; (6) `moveRefill` field whitelist + bigint→string; (7) `quoteSell` allowlist; (8) missing tests → added; (9) Gate 0 sim lacks reference floor → carried to Phase 3. Tests after fixes: 69 unit/API/DB, 8 fork, verify pass.
- **2026-11-24 — Phase 2 built.** Files: `server/src/{app,index}.js`, `server/src/config/{env,limits}.js`, `server/src/db/index.js`, `server/src/auth/session.js`, `server/src/routes/{auth,me,agents,permissions}.js`, `server/src/chain/spendPermission.js`, `server/test/api/*`, `server/test/fork/smartWalletSignatures.test.js`, `client/src/{App,api,format,wallet}.js(x)`, `client/src/pages/*`, `client/src/components/*`, `server/.env.example`, `server/package.json` (dev reads `.env`). Tests: verify pass, 114 server tests; 11 fork tests. Tx hashes: none. Env changes (names): `APP_ORIGIN`, `SPENDER_ADDRESS`, `MONGODB_URI` now required. Limits: real wallet sign-in and permission signing not tried yet (P2-STOP); Vercel → Render same-origin rewrite not written yet (Phase 5). Next: owner check, then Phase 3.

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
| M10 | Create a smart wallet and move a few dollars of NVDAc into it. No ETH or USDC needed there | ✅ wallet created and funded 2026-11-24: `0x406bd02d69f1f5d9850c330e7da8252b1a5f4c56` (EIP-7702 account running Coinbase Smart Wallet code; owners = itself + Spend Permission Manager). Simulated grant + spend of 0.01 NVDAc from it to our spender: success. Funded with 0.02065741 NVDAc (read on chain). Still to confirm in Phase 2: the wallet app shows and signs a spend permission request |

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
