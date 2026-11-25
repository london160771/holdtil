# PROJECT_STATE — Holdtil

> Where the project actually stands. A progress log, not requirements (those live in `PRD.md`).
> Update at the end of every phase. Only write what was verified. If this file and the repo disagree, the repo wins.

**Last updated:** 2026-11-25 15:10 WAT · **By:** Claude · **Commit:** see §2 / §10

---

## 1. Right now

- **Active phase:** Phase 5 — polish + launch (Phase 4 done except Scout's first Holdtil refill, which needs tomorrow's allowance).
- **Status:** Building. Deploy guide ready (P5-DEPLOY below). Checkpoint C (security review) next.
- **Next step:** Owner: P5-DEPLOY when ready (the owner always deploys). 2026-11-26: P4-STOP step 6 (refill Scout). Claude: Checkpoint C.
- **Blocked by:** nothing for Claude. Owner steps above.

**P5-BANKR — put the fair-price check live on Bankr (owner only; agents never deploy)**
- *What and why:* Holdtil's fair-price rule becomes a paid API ($0.01 USDC per call) hosted on Bankr x402 Cloud. Bankr runs it, takes each payment on Base and lists it for Bankr agents. Each answered check shows on `/proof`. Do this after the Render deploy (it needs your Render URL).
- *Steps (on your PC, in the repo folder):*
  1. `git pull`, then `npm install`.
  2. Make a Bankr account at bankr.bot (sign in with email). Put about $0.10 of USDC on Base in your Bankr wallet for your own test calls.
  3. Install the CLI: `npm install -g @bankr/cli`, then `bankr login` and follow the email code.
  4. Make a new long random string (password manager) for the record secret. Never paste it in chat.
  5. `cd bankr`, then set the handler's env on Bankr (you type the values):
     `bankr x402 env set BASE_RPC_URL=<your CDP RPC URL>`
     `bankr x402 env set HOLDTIL_CHECKS_URL=https://<your-render-service>.onrender.com/internal/checks`
     `bankr x402 env set CHECK_SECRET=<the random string>`
  6. Deploy: `bankr x402 deploy fair-price`. It prints the endpoint URL, `https://x402.bankr.bot/<your wallet>/fair-price`.
  7. Render → Environment: `CHECK_SECRET` = the same random string, `FAIR_PRICE_URL` = the URL from step 6. Render redeploys.
- *Your approval of the first real paid call:* `bankr x402 call "https://x402.bankr.bot/<wallet>/fair-price?usdc=1" --max-payment 0.02` (or ask your Bankr agent in chat: "call the Holdtil fair-price endpoint for $1 of NVDA").
- *How to check it worked:* the answer has `"verdict": "sell"` or `"wait"`; `/proof` → "Fair-price checks sold on Bankr" shows it; `bankr x402 revenue` shows $0.01. Paste the endpoint URL (public) in the thread.
- *Then:* ask in the Bankr partner Telegram to mark the endpoint discoverable, so Bankr agents can find it.
- *What happens next:* Claude checks the live endpoint and `/proof`, and records it in REAL_VS_MOCKED.

**P5-BUILDER — turn on Base Builder Codes (owner, ~5 min)**
- *What and why:* every refill can carry Holdtil's Base Builder Code, so Base counts that onchain activity as Holdtil's (base.dev leaderboards, future rewards). Code is done and tested; it stays off until you set the code.
- *Steps:*
  1. Open dashboard.base.org, sign in, create a project named Holdtil (URL = your Vercel URL or holdtil.xyz).
  2. Settings → Project Settings → **Builder Code**. Copy the short code (looks like `bc_b7k3p9da`). It is public, not a secret.
  3. Set `BUILDER_CODE=` that code in `server/.env` on your PC, and on Render → Environment when you deploy.
- *Check it worked:* the next real refill (your approval = running it, as before) → copy its user-op hash or tx hash → builder-code-checker.vercel.app → **Check Attribution** shows your code. Paste the tx hash in the thread.
- *What happens next:* Claude confirms the tag on chain and records it in REAL_VS_MOCKED.

**P5-DEPLOY — put Holdtil online (owner only; agents never deploy)**
- *What and why:* run the API on Render, the web app on Vercel (same domain, so sign-in cookies work), and a 5-minute timer that runs refills and keeps Render and MongoDB Atlas awake. Live refills stay limited to your account with the $1 cap (rollout step 4).
- *Before you start:* merge the Holdtil pull request into `main` (Claude opens it). Render and Vercel deploy from `main`.
- *Part 0 — two safety steps from the security review (do these first)*
  1. **Prod spender (review #1).** The current spender's keys are dev keys that cloud build sessions can see. For real users the spender must be controlled by keys only Render has. CDP portal → create a new project `holdtil-prod` → API key + Wallet Secret (keep them only in Render). Put those keys plus `BASE_RPC_URL` in `server/.env.prod` on your PC (git ignores it) and run `npm run spender:prod -- info`. It creates the prod spender and prints only its address. Then: `SPENDER_ADDRESS` on Render = that new address, send it ~$1 of ETH on Base for gas, and re-sign your Spend Permission on the dashboard (permissions are tied to one spender). Until then keep `LIVE_USER_ADDRESSES` to your own address only.
  2. **Scout's own database user (review #2).** Atlas → Database Access → **Add New Database User**: name `scout`, password auth, **Specific Privileges** → add a custom role with actions `find`, `insert`, `update`, `createIndex` on database `holdtil`, collection `scoutRuns` only. Use this user's connection string as Scout's `MONGODB_URI` (GitHub secret and `scout/.env`), never the app's.
- *Part A — API on Render*
  1. render.com → **New → Web Service** → connect GitHub → pick the `holdtil` repo, branch `main`.
  2. Settings: Language **Node**. Root directory: leave empty. Build command: `npm ci`. Start command: `npm start -w server`. Instance type: **Free**. Health check path: `/health`.
  3. **Environment** tab, add (values typed by you, never pasted in chat). Use **prod** values, not the cloud dev ones:
     `BASE_RPC_URL` (your CDP RPC URL), `MONGODB_URI` (Atlas), `SESSION_SECRET` and `TICK_SECRET` (two new long random strings, e.g. from a password manager), `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` (the CDP project that owns the spender), `SPENDER_ADDRESS=0xb7F3c5F916359B303d3ecEbB39f47969444fd15B`, `APP_ORIGIN` (your Vercel URL from Part B, e.g. `https://holdtil.vercel.app`; put a placeholder first and fix it after Part B), `TRUST_PROXY_HOPS=2`, `SCOUT_ADDRESS=0x6E69A457FA9487d099CB2c428Ca33b74ee818001`, `EXECUTOR_MODE=live`, `LIVE_USER_ADDRESSES=0x406bd02d69f1f5d9850c330e7da8252b1a5f4c56`, `LIVE_MAX_REFILL_USDC=1000000`.
  4. Atlas → **Network Access**: allow Render to connect (simplest on the free plan: `0.0.0.0/0`, the database password still protects it).
  5. Deploy. Check: open `https://<your-service>.onrender.com/health` → `"status":"ok"` and `"db":"ok"`.
  6. Paste the Render URL (public, not a secret) in the thread. Claude adds it to `client/vercel.json` (the `/v1` rewrite) and pushes.
- *Part B — web app on Vercel* (after Claude pushes `vercel.json`)
  1. vercel.com → **Add New → Project** → import `holdtil`. Root directory: `client`. Framework: Vite. No env vars needed.
  2. Deploy. Copy the URL (e.g. `https://holdtil.vercel.app`) and set it as `APP_ORIGIN` on Render (Part A step 3). Render redeploys.
  3. Check: open the Vercel URL → sign in with Base works, dashboard shows your agents, `/proof` shows Scout.
- *Part C — timer (cron-job.org, free)*
  1. Create a job: URL `https://<your-service>.onrender.com/internal/tick`, method **POST**, every **5 minutes**, header `x-tick-secret` = your `TICK_SECRET`.
  2. Create a second job: URL `https://<your-service>.onrender.com/health`, method GET, every **10 minutes**. **This is the keep-alive:** each call pings MongoDB, so the Atlas free cluster never pauses for inactivity, and Render stays awake.
  3. Check: the cron-job.org history shows 200 for both; the dashboard shows new decisions every 5 minutes.
- *Part D — Scout 24/7 on GitHub Actions, hourly (owner chose 2026-11-25). Do this after the PR is merged into `main`; schedules only run from `main`.*
  1. GitHub → `holdtil` repo → **Settings → Secrets and variables → Actions → New repository secret**: `SCOUT_PRIVATE_KEY` (copy it from your `scout/.env` yourself, never into chat) and `MONGODB_URI`.
  2. Same page → **Variables** tab → `SCOUT_MODE` = `live`.
  3. **Actions** tab → `scout` → **Run workflow** once. Check: the log ends with `"status":"paid"` (or `budget_reached` once $0.30 is spent that day); `/proof` shows the run. After that it runs by itself every hour at :17.
  4. On your PC set `SCOUT_MODE=` empty in `scout/.env`, so Scout doesn't also pay from there.
- *Domain (optional, later):* Vercel → project → Domains → add `holdtil.xyz` and follow the DNS steps; then set `APP_ORIGIN=https://holdtil.xyz` on Render.
- *What happens next:* Claude checks `/health`, `/proof` and the first ticks on the live URL, and records the URLs in README and REAL_VS_MOCKED.

**P4-STOP — give Scout a wallet, refill it with Holdtil, approve its first real payment**
- *What and why:* Scout is our own agent that pays x402stock.xyz ($0.03 a call) for market data. It needs its own wallet, and Holdtil should refill that wallet from your NVDAc like any agent. Its first real payment needs your approval.
- *Steps (on your computer, in the repo folder):*
  1. `git pull`, then `npm install`.
  2. Copy `scout/.env.example` to `scout/.env`. Set `MONGODB_URI` to the same value as in `server/.env`.
  3. Run `npm run scout:new-key`. It saves a new key in `scout/.env` and prints only **Scout's address**. Never paste the key anywhere.
  4. In `server/.env` set `SCOUT_ADDRESS=` that address (public, not a secret).
  5. `npm run dev`, open http://localhost:5173/app → **Add agent**: name `Holdtil Scout`, wallet = Scout's address, limits empty (defaults).
  6. Refill Scout once (same as before): set `EXECUTOR_MODE=live` in `server/.env`, run `npm run tick` once, then set `EXECUTOR_MODE=` empty again. Expect `"result": "confirmed"` for the Scout agent (~$1 USDC, within your 0.01 NVDAc/day permission; if today's allowance is used up it says `allowance_exhausted` — then do this step tomorrow).
  7. Dry run Scout: `npm run scout`. Expect `"status": "dry_run"` and `"wouldPayAtomic": "30000"` ($0.03).
  8. **Your approval of Scout's first real payment:** set `SCOUT_MODE=live` in `scout/.env`, run `npm run scout` **once**.
- *How to check it worked:* step 8 prints `"status": "paid"` with an `x402TxHash`. Open http://localhost:5173/proof: Scout's payment and its refill both show with BaseScan links. Paste both tx hashes in the thread.
- *What happens next:* Claude verifies both on chain, records them, and starts Phase 5 (polish + launch; that includes your deploy guide so `/proof` and Scout run 24/7).

## 2. Phase tracker

| Phase (PRD §27) | Status | Verified on | Commit | Review |
|---|---|---|---|---|
| 0 — Foundation + Gate 0 | Done | 2026-11-24 | `1115b8c` | Gate 0 reviewed by Opus (orchestrator); passed |
| 1 — Core engine | Done | 2026-11-24 | `91ab9a5` + review fixes (see §10) | A done; 9 findings fixed or carried to Phase 3 |
| 2 — Accounts, agents, permissions | Done (owner check passed 2026-11-25) | 2026-11-25 | `7628b7b` + fixes `1358c71`, `34547ab` | — |
| 3 — Refill executor | Done (first real refill confirmed) | 2026-11-25 | `27db5e8` + fixes to `7854cd1` | B done |
| 4 — Holdtil Scout + proof page | Built (dry); owner steps pending (P4-STOP) | 2026-11-25 | see §10 | — |
| 5 — Product polish + launch | Not started | | | C |
| 6 — Video, X post, submission | Not started | | | — |
| 7 — P1 extras | Not started | | | — |

## 3. Last verification

| Check | Command | Result | Date |
|---|---|---|---|
| Full gate | `npm run verify` | pass (exit 0): lint 0 warnings, 180 server tests (18 files), 11 scout tests, client build ok | 2026-11-25 |
| Fork tests | `npm run test:fork` | 18 passed (4 files), incl. executor batch with the real CDP spender: 0.00682772 NVDAc → 1.005479 USDC to agent, min-out 1.000451, gas 413,062 (simulation) | 2026-11-25 |
| Real dry-run tick | `runTick` dry, in-memory DB, real RPC + CDP spender, throwaway unfunded user | real price (gap 4 bps), planned → checked → waited `simulation_failed` (user had no NVDAc), nothing sent | 2026-11-25 |
| UI | Playwright screenshots (API mocked for layout only) | redesign: landing, docs, proof, dashboard, agent at 1440 and 390, no horizontal scroll | 2026-11-25 |
| Real wallet | owner sign-in + spend permission | pass (P2-STOP), signing only | 2026-11-25 |
| Real refill | owner ran `npm run tick` live (owner's account only, $1 cap) | confirmed: tx `0x576245f2149007aeafc3fdc32efd2982d6fd24ae1cca4e4e72b470d75aa58655`, 0.00665098 NVDAc → 0.988785 USDC to agent (min-out 0.983841), gas 0.0000074 ETH incl. spender deploy | 2026-11-25 |

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

| What | Value | Checked |
|---|---|---|
| First real refill (Base mainnet) | [`0x576245f2…`](https://basescan.org/tx/0x576245f2149007aeafc3fdc32efd2982d6fd24ae1cca4e4e72b470d75aa58655) · block 62076859 · 2026-11-25 11:22:27 UTC | on chain by Claude 2026-11-25 |
| Sold | 0.00665098 NVDAc from owner Base Account `0x406b…4c56` via Spend Permission (`approveWithSignature` + `spend` in the same batch) | Transfer logs |
| Paid | 0.988785 USDC from the Aerodrome pool to agent `0xbAbD…7589` (min-out 0.983841, deadline set) | Transfer logs + decoded user op |
| Gas | 0.00000739 ETH from the spender (incl. first-time smart account deploy); no paymaster | spender balance 0.0005 → 0.00049261 ETH |
| Spender after | holds 0 NVDAc, 0 USDC (never user money) | balances read on chain |
| Scout first funding | 0.1 USDC sent by the owner by hand (not a Holdtil refill) to Scout `0x6E69…8001`; balance 100000 read on chain | on chain by Claude 2026-11-25 |
| Scout's first x402 payment | [`0x57a8130e…`](https://basescan.org/tx/0x57a8130e63de6c5ddd17daa51af113819cc8a2524f9455d4a8e912ef660cf3db) · block 62088788 · 2026-11-25 12:02:13 UTC · 0.03 USDC from Scout `0x6E69…8001` to x402stock `0x3070…fA85` for `market-pulse` (HTTP 200, summary stored) · funded by the owner's manual 0.1 USDC | on chain by Claude 2026-11-25 |
| Second real refill | [`0x062d974c…`](https://basescan.org/tx/0x062d974c2c4c3ef32b5d86046ca08a426828f19f29bbc89eb3e0cd1506fbc815) · block 62086750 · 2026-11-25 11:55:25 UTC · 0.00334870 NVDAc → 0.494924 USDC to Test Agent `0xbAbD…7589` (rest of the day's allowance) · user op success, gas 0.0000030 ETH | on chain by Claude 2026-11-25 |

## 7. Demo recordings (PRD §22)

| Act | Recorded? | File / link | Date |
|---|---|---|---|
| 1 — Dangerous default | no | | |
| 2 — New way | no | | |
| 3 — Real action | no | | |
| 4 — Break it | no | | |
| 5 — Control returns | no | | |

## 8. Known issues and limitations
- Flaky test (seen 2026-11-25, 1 of 4 runs): `tick.test.js` "two ticks in different 5-minute windows at once → still one refill". The fake chain's USDC balance never rises after a refill, so if the first tick fully confirms before the second plans, the second refills again. Test timing only, not a product bug (on chain the balance rises). Fix later by making the fake balance rise after a confirmed refill.

- Eligibility confirmed: owner bought and holds NVDAc from Nigeria (2026-11-24).
- Anvil can't run B20 precompiles; B20 tests use `eth_simulateV1` (PRD §16).
- Spend permission signing confirmed with the owner's Base Account popup (2026-11-25, PRD §33 Q6). The permission is only signed; it is approved on chain by the first refill (`approveWithSignature`).
- NVDAc/USDC pool is small (~18.7k USDC side). Fine for small refills.
- `npm audit`: 3 high-severity advisories inside `@coinbase/cdp-sdk`'s own nested `zod`/`abitype`. The only "fix" downgrades the SDK to 1.7.0. Left as is; re-check before launch (Checkpoint C).
- Dev spender created (M9 done): `0xb7F3c5F916359B303d3ecEbB39f47969444fd15B`. Owner's Base Account `0x406b…4c56` funded with NVDAc (M10 done).
- The owner's smart wallet is an EIP-7702 account. Sign in falls back to plain signature recovery when the address has 7702 code (PRD §16). Worked with the real wallet 2026-11-25.
- Same-origin hosting (Vercel rewrite of `/v1` to Render) is needed for the session cookie in production. Guide: P5-DEPLOY (§1); `client/vercel.json` is added once the Render URL is known.

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
- **2026-11-25 — P2-STOP fix.** Owner's first sign-in showed "Wrong network" (the wallet signed a message for another chain). Fix: the app now switches the Base Account provider to Base and builds the sign-in message itself with chain 8453; the server error names the chain it got. verify pass (114 tests). Owner to re-pull and retry.
- **2026-11-25 — P2-STOP fix 2.** Sign-in and Add agent worked for the owner. Signing the permission failed with "salt must be a whole number": the Base Account SDK sends salt as 32-byte hex and defaults `end` to forever. Fix: server accepts decimal or hex numbers; app sets `end` to 365 days (server max 366). 2 new API tests; verify pass (116 tests).
- **2026-11-25 — Phase 2 owner check passed.** Owner signed in with Base (`0x406b…4c56`), added agent "Test Agent" (`0xbAbD…7589`), signed an NVDAc spend permission of 0.01/day. Dashboard: left today 0.01, status `active`. Data is in the owner's local dev DB; nothing on chain yet (no tx). Phase 3 started.
- **2026-11-25 — Phase 3 built (dry run).** Files: `server/src/executor/tick.js`, `server/src/chain/{refillBatch,executorChain,spender}.js`, `server/src/config/executor.js`, `server/src/routes/{tick,refills}.js`, `server/scripts/tick.js`, `server/src/{app,index,errors}.js`, `server/src/db/refills.js`, `server/src/config/env.js`, `client/src/components/Receipts.jsx`, `client/src/pages/Agent.jsx`, tests `server/test/executor/tick.test.js` (22), `server/test/fork/executor.fork.test.js` (7). Tests: verify pass (138), fork 18. Tx hashes: none. Env (names): `EXECUTOR_MODE` (optional; unset = dry). Limits: no real refill yet; spender not deployed and has 0 ETH. Next: Checkpoint B, then owner stop.
- **2026-11-25 — Checkpoint B (fresh-eyes review, separate agent).** No path found that sells at a bad price, over a limit, to the wrong place, twice, while paused or in dry mode. Findings fixed: (1, high) live mode now only for `LIVE_USER_ADDRESSES` with a $1 cap; (2) fresh chain time per agent and for the deadline; (3) CDP idempotency key as UUID v4; (4) settle reads our own user-op success, counts only pool → agent USDC, unclear results stay locked with an alert; (5) hash-save failure logged + alerted; (6) agent/user re-read under the lock; (7) decimals read on chain each tick. Deferred to Checkpoint C: (8) restrict permission signers to Coinbase Smart Wallet / 7702; (9) alert after 3 simulation failures. 14 new tests. verify pass (152), fork 18.
- **2026-11-25 — Owner dry run #1:** blocked `allowance_exhausted`. Cause: dry runs didn't apply the $1 rollout cap, so it planned ~$1.97 = 0.0134 NVDAc, over the 0.01/day permission. Fix: rollout cap applies in dry too; refill shrinks to fit the allowance left. Spender gas confirmed: 0.0005 ETH at `0xb7F3…d15B`. 2 regression tests; verify pass (154).
- **2026-11-25 — Owner live tick #1:** `skipped refill_in_flight`, nothing sent (checked on chain: spender still 0.0005 ETH and undeployed, owner NVDAc 0.02065741 unchanged, agent USDC 0). Cause: the dry run and the live run were in the same 5-minute window and shared the refill id. Fix: id includes the mode; clearer skip reason. 2 regression tests; verify pass (156).
- **2026-11-25 — Owner live tick #2:** `waited price_stale` "reference time is in the future", nothing sent (checked on chain). Cause: block time read before the feed; the RPC served the feed from a newer block. Fix: up to 30 s of future skew counts as fresh. 3 tests; verify pass (159).
- **2026-11-25 — Phase 3 done. First real refill confirmed** (owner-approved, rollout step 4): tx `0x576245f2149007aeafc3fdc32efd2982d6fd24ae1cca4e4e72b470d75aa58655`. Verified on chain: user op success; 0.00665098 NVDAc pulled from `0x406b…4c56`; 0.988785 USDC to agent `0xbAbD…7589` ≥ min-out 0.983841; swap recipient = DB agent wallet; spender deployed in the same op, left with 0 NVDAc / 0 USDC; gas 0.00000739 ETH. Acceptance (PRD §27): lab #1–7 tests pass + one real refill with receipt. Next: Phase 4.
- **2026-11-25 — Phase 4 built (dry).** Files: `scout/src/{scout,main}.js`, `scout/scripts/new-key.js`, `scout/test/scout.test.js` (8), `scout/.env.example`, `server/src/routes/proof.js`, `server/test/api/proof.test.js` (3), `server/src/{app,config/env,db/index}.js`, `client/src/pages/Proof.jsx`, `client/src/App.jsx`. Tests: verify pass (162 server + 8 scout). Screens: `/proof` at 1280 and 390, no horizontal scroll (API mocked for layout). Tx hashes: none. Env (names): `SCOUT_PRIVATE_KEY`, `SCOUT_MODE`, `SCOUT_DAILY_MAX_USDC`, `SCOUT_INTERVAL_MIN` (scout/.env), `SCOUT_ADDRESS` (server/.env). Limits: no real Scout payment yet; Scout runs only on the owner's PC until deploy (Phase 5). Next: P4-STOP.

- **2026-11-25 — Refill order fix.** Step 6 live tick: Test Agent (slightly under its $1 floor) took the rest of the day's shared allowance (tx `0x062d974c2c4c3ef32b5d86046ca08a426828f19f29bbc89eb3e0cd1506fbc815`, verified), so Scout ($0) got `allowance_exhausted`. Fix: each tick now orders agents by how far below the floor they are (unreadable balance last); decisions still read balances fresh. +2 tests. Tx: none sent by Claude.

- **2026-11-25 — Phase 5 started.** Rate limits on auth, writes, proof and tick (+3 tests). `/docs` connect guide page (screenshots at 1280px and 390px checked, no sideways scroll). Clear message when the API can't be reached (502/503/504 or network error) instead of "Request failed (502)".

- **2026-11-25 — Fix: Scout crashed at start with IndexOptionsConflict** (owner step 7). The server makes the `scoutRuns` indexes as `runId_unique` and `recent`; Scout made the same keys with default names. Scout now uses the same names (`ensureScoutIndexes`), +1 test that runs both orders on one database. No Atlas cleanup needed. Nothing was paid.

- **2026-11-25 — Phase 4: first real Scout payment** (owner-approved, step 8): tx `0x57a8130e63de6c5ddd17daa51af113819cc8a2524f9455d4a8e912ef660cf3db`. Verified on chain: success; one USDC Transfer of 30000 ($0.03) from Scout to x402stock's payTo `0x3070Fbb3803819fB5BdfE9286fdc6325A877fA85`. Paid from 0.1 USDC the owner sent by hand. Second real refill (to Test Agent) `0x062d974c…c815` also verified. Left for Phase 4 acceptance: Scout's first Holdtil refill (2026-11-26).

- **2026-11-25 — Phase 5: deploy prep.** Keep-alive (owner request): `/health` now pings MongoDB (`db: ok`, 503 if down); cron-job.org calls it every 10 min so the Atlas free cluster never pauses, and the 5-min tick also uses the DB. `Cache-Control: no-store` on `/v1` and `/internal` (Vercel external rewrites cache by default). `TRUST_PROXY_HOPS` (2 behind Vercel + Render) so rate limits are per client IP. `.node-version` 22. Dashboard retry when the API is down. +5 tests. Deploy guide P5-DEPLOY in §1.

- **2026-11-25 — Scout hosting prep.** `.github/workflows/scout.yml`: hourly `npm run scout` from GitHub Actions, skipped until the owner adds the repo secrets; pays only with repo variable `SCOUT_MODE=live`. Scout now returns `budget_reached` (no error, nothing reserved) once the day's budget can't cover a call. +1 scout test. Owner picks where Scout runs (card in thread; recommended GitHub Actions).

- **2026-11-25 — Checkpoint C (security review, fresh agent) and fixes.** 2 high, 4 medium, 4 low. Fixed in code: #3 raw error text (could hold the RPC key) no longer stored or returned (`safeMessage`); #4 max 5 agents per user, agents with no signed permission cost no chain reads, GET limit 120/min; #5 shared auth cap 300/min (per-IP can be faked on the Render URL); #6 tick answers 500 on any alert (cron-job.org emails), and an agent waits after 2 failed txs in 24 h; #7 `/proof` shows only the first agent registered for Scout's wallet; #8 in-flight spend counts max(planned, max payout); #9 cross-site writes refused by Origin; #10 Scout pins x402stock's payTo; workflow pins actions by SHA and installs Scout only with `--ignore-scripts`. Owner steps (guide Part 0): #1 prod CDP spender, #2 Scout-only Atlas user. Not changed: ERC-1271 signers stay allowed (gas risk now capped by #6); `npm audit` 4 high in cdp-sdk's nested zod/abitype (server passes only its own data; re-check later). +9 server tests, +1 scout test.

- **2026-11-25 — Owner asks: docs, README, withdraw.** `/docs` rewritten as a plain-language guide for web2 and web3 readers (glossary, steps, when it waits, stop/revoke, dev snippet, FAQ); header link "Docs"; checked at 1280 and 390. Dashboard **Revoke** button (Base Account SDK `requestRevoke`; the user's own wallet sends it). README rewritten: simple intro, mainnet tx proof table, judge path, technical section. Withdraw guide `docs/withdraw.md` + sweep scripts, dry by default: `npm run scout:sweep` (Scout's USDC), `npm run spender[:prod] -- info|sweep [--send]` (spender ETH; also creates the prod spender with `info`). Spender sweep dry run checked against the dev spender (nothing sent).

- **2026-11-25 — Frontend redesign + logo (owner picked logo A).** Pre-deploy item 1. Look: warm paper and ink with one Base-blue accent, Geist + Geist Mono + Instrument Serif (self-hosted via Fontsource), lucide icons. Logo A (two hold bars + rising stock line) in the header and as favicon (`client/public/favicon.svg`, `logo.svg`). Signature: every refill/decision is printed as a ticker-tape row (`components/Tape.jsx`); waits use the hold-bars glyph. Landing: hero with a real public-domain photo of Edison's stock ticker (Smithsonian NMAH via Wikimedia Commons, credited in the footer) and a paper tape that prints Scout's latest real decisions from `GET /v1/proof` (labelled "Example" with no hashes or dates when there are none); "how it works" cards; animated fair-price gate; rules; risks. App screens restyled with no logic change. Motion: one entrance, tape print, scroll reveal, gate animation, float bar fill; all off under reduced motion. Checked at 1440 and 390 with mocked API.

- **2026-11-25 — README rewrite + first-time guide (owner request).** README now covers: the problem, who needs it, where the money sits (stock balance in the owner's Base Account vs USDC float in the agent wallet, with a worked refill), features, a new-user guide, day-to-day use, adding a real agent (and the live-list rollout limit), accounts (one Base Account per user, data scoped per user), security (can / cannot), security proof (mainnet txs, break-it tests, fork tests, reviews), why Base, tech stack. `/docs` gets "First time here", "Where your money sits" and a rollout FAQ. No code logic changed. verify pass (180 server, 11 scout).

- **2026-11-25 — New opening copy (owner wrote it).** README intro and landing hero now lead with "Your agent's budget should be working, even when it's not spending." Landing: hero sub, "How it works" intro, and a closing line before Risks. Tagline "budget stays invested until it pays" stays for the page description and X bio.

- **2026-11-25 — Base Builder Codes (sponsor item 2, owner pick 1).** Files: `server/src/chain/builderCode.js` (new), `executorChain.js` (suffix on send and in the simulation), `config/env.js` (`BUILDER_CODE`), `index.js`, `scripts/tick.js`, `server/package.json` (+`ox`), tests `test/builderCode.test.js` (6) and one fork case. Tests: verify pass (186 server, 11 scout); fork `executor.fork.test.js` 8 passed: tagged batch pays the agent the same USDC, +458 gas. Tx hashes: none. Env: `BUILDER_CODE` (new, public). Limits: x402 payments can't be tagged (facilitator submits them); off until the owner sets the code (P5-BUILDER). Docs: PRD §15/§16 + deadline fixed to 12 Dec 23:59 UTC, CLAUDE.md gotcha, REAL_VS_MOCKED.

- **2026-11-25 — Fair-price check on Bankr x402 Cloud (FR-FPC-001, sponsor item 2, owner pick).** Files: `bankr/` workspace (`bankr.x402.json`, `x402/fair-price/index.ts` handler, `check.js`, `constants.js`, `lib/` = exact copies of `server/src/core`, `scripts/sync.js`, tests), `server/src/routes/checks.js` (POST `/internal/checks`), `routes/proof.js` (+`fairPrice`, `checks`), `app.js` (route + its own shared rate limit), `config/env.js` (`CHECK_SECRET`, `FAIR_PRICE_URL`), `db/index.js` (indexes), `client/src/pages/Proof.jsx` (new section; screenshots 1280 + 390 checked), PRD §9 FR-FPC-001, §14, §15, §16, §22, §26. Tests: verify pass (191 server, 11 scout, 20 bankr); live read on Base mainnet: $1 of NVDAc → `sell`, gap 10 bps, Chainlink $142.04 (20 min old), min-out 0.999034 USDC. Tx hashes: none. Env: `CHECK_SECRET`, `FAIR_PRICE_URL` (server); `BASE_RPC_URL`, `HOLDTIL_CHECKS_URL`, `CHECK_SECRET` (Bankr). Limits: not deployed (owner step P5-BANKR); Bankr discovery listing is Bankr's call; only NVDAc.

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
2. Bio: "Your agent's budget stays invested until it pays. Built on @base."
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
