# PROJECT_STATE — Holdtil

> Where the project actually stands. A progress log, not requirements (those live in `PRD.md`).
> Update at the end of every phase. Only write what was verified. If this file and the repo disagree, the repo wins.

**Last updated:** 2026-11-24 23:30 WAT · **By:** Claude · **Commit:** see §2 / §10

---

## 1. Right now

- **Active phase:** Phase 3 — Refill executor: built, Checkpoint B done and all findings 1–7 fixed.
- **Status:** Stopped (CLAUDE.md §10 items 1 and 3): the spender needs gas, and the first real refill needs the owner.
- **Next step:** owner does P3-STOP below (fund gas → dry run on own data → one real $1 refill).
- **Blocked by:** P3-STOP.

**P3-STOP — dry run, then the first real $1 refill (owner only)**
- *What and why:* The executor passed tests, fork simulations and the Checkpoint B review. The last rollout steps (CLAUDE.md §6 steps 2 and 4) need your own data and your approval: Holdtil sells about $1 of your NVDAc through the permission you signed and sends the USDC to your test agent `0xbAbD…7589`.
- *Steps:*
  1. ✅ done 2026-11-25 (0.0005 ETH confirmed on chain). **Gas for the spender.** From any Base wallet, send **0.0005 ETH on Base** to Holdtil's spender `0xb7F3c5F916359B303d3ecEbB39f47969444fd15B`. It pays gas only; it never holds user money. Check it on basescan.org (address page shows the ETH).
  2. In your local repo: `git pull` (branch `claude/project-thread-uqb47q`).
  3. In `server/.env` add your **dev** CDP keys (same names as in the cloud environment): `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`. Never paste them in chat. Leave `EXECUTOR_MODE` empty.
  4. Do this on a weekday (the NVDA reference is 24/5; weekends always wait). Run `npm run tick`. It prints `executor mode: dry` and a summary.
  5. Check the summary: your agent's line should say `"code": "dry_run"` with "would sell … to 0xbAbD…". The agent page in the app shows the same under "Refills and decisions". If it says something else (e.g. `price_stale`, `simulation_failed`), copy that line (no secrets) into the thread and stop here.
  6. **Only if step 5 shows `dry_run`:** in `server/.env` set `EXECUTOR_MODE=live` and `LIVE_USER_ADDRESSES=0x406bd02d69f1f5d9850c330e7da8252b1a5f4c56`. Run `npm run tick` **once**. This is your approval of the first real refill. The cap is $1 per refill (`LIVE_MAX_REFILL_USDC` default).
  7. Right after, set `EXECUTOR_MODE=` (empty) again in `server/.env`, so nothing else runs live.
- *How to check it worked:* the summary shows `"result": "confirmed"` with a `txHash`. The agent page shows a green `confirmed` receipt with a BaseScan link, and the agent's USDC float is about $1. Paste the tx hash in the thread.
- *What happens next:* Claude verifies the tx on chain, records it (PROJECT_STATE, REAL_VS_MOCKED, PRD §16), and starts Phase 4 (Scout + `/proof`).

## 2. Phase tracker

| Phase (PRD §27) | Status | Verified on | Commit | Review |
|---|---|---|---|---|
| 0 — Foundation + Gate 0 | Done | 2026-11-24 | `1115b8c` | Gate 0 reviewed by Opus (orchestrator); passed |
| 1 — Core engine | Done | 2026-11-24 | `91ab9a5` + review fixes (see §10) | A done; 9 findings fixed or carried to Phase 3 |
| 2 — Accounts, agents, permissions | Done (owner check passed 2026-11-25) | 2026-11-25 | `7628b7b` + fixes `1358c71`, `34547ab` | — |
| 3 — Refill executor | Built; Checkpoint B done; first real refill pending (P3-STOP) | 2026-11-25 | see §10 | B done |
| 4 — Holdtil Scout + proof page | Not started | | | — |
| 5 — Product polish + launch | Not started | | | C |
| 6 — Video, X post, submission | Not started | | | — |
| 7 — P1 extras | Not started | | | — |

## 3. Last verification

| Check | Command | Result | Date |
|---|---|---|---|
| Full gate | `npm run verify` | pass (exit 0): lint 0 warnings, 156 server tests (15 files), client build ok | 2026-11-25 |
| Fork tests | `npm run test:fork` | 18 passed (4 files), incl. executor batch with the real CDP spender: 0.00682772 NVDAc → 1.005479 USDC to agent, min-out 1.000451, gas 413,062 (simulation) | 2026-11-25 |
| Real dry-run tick | `runTick` dry, in-memory DB, real RPC + CDP spender, throwaway unfunded user | real price (gap 4 bps), planned → checked → waited `simulation_failed` (user had no NVDAc), nothing sent | 2026-11-25 |
| UI | Playwright screenshots (API mocked for layout only) | agent page with receipts at 1280 and 390: no horizontal scroll | 2026-11-25 |
| Real wallet | owner sign-in + spend permission | pass (P2-STOP), signing only | 2026-11-25 |
| Real refill | — | **not sent yet** (needs owner approval) | — |

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
- Spend permission signing confirmed with the owner's Base Account popup (2026-11-25, PRD §33 Q6). The permission is only signed; it is approved on chain by the first refill (`approveWithSignature`).
- NVDAc/USDC pool is small (~18.7k USDC side). Fine for small refills.
- `npm audit`: 3 high-severity advisories inside `@coinbase/cdp-sdk`'s own nested `zod`/`abitype`. The only "fix" downgrades the SDK to 1.7.0. Left as is; re-check before launch (Checkpoint C).
- Dev spender created (M9 done): `0xb7F3c5F916359B303d3ecEbB39f47969444fd15B`. Owner's Base Account `0x406b…4c56` funded with NVDAc (M10 done).
- The owner's smart wallet is an EIP-7702 account. Sign in falls back to plain signature recovery when the address has 7702 code (PRD §16). Worked with the real wallet 2026-11-25.
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
- **2026-11-25 — P2-STOP fix.** Owner's first sign-in showed "Wrong network" (the wallet signed a message for another chain). Fix: the app now switches the Base Account provider to Base and builds the sign-in message itself with chain 8453; the server error names the chain it got. verify pass (114 tests). Owner to re-pull and retry.
- **2026-11-25 — P2-STOP fix 2.** Sign-in and Add agent worked for the owner. Signing the permission failed with "salt must be a whole number": the Base Account SDK sends salt as 32-byte hex and defaults `end` to forever. Fix: server accepts decimal or hex numbers; app sets `end` to 365 days (server max 366). 2 new API tests; verify pass (116 tests).
- **2026-11-25 — Phase 2 owner check passed.** Owner signed in with Base (`0x406b…4c56`), added agent "Test Agent" (`0xbAbD…7589`), signed an NVDAc spend permission of 0.01/day. Dashboard: left today 0.01, status `active`. Data is in the owner's local dev DB; nothing on chain yet (no tx). Phase 3 started.
- **2026-11-25 — Phase 3 built (dry run).** Files: `server/src/executor/tick.js`, `server/src/chain/{refillBatch,executorChain,spender}.js`, `server/src/config/executor.js`, `server/src/routes/{tick,refills}.js`, `server/scripts/tick.js`, `server/src/{app,index,errors}.js`, `server/src/db/refills.js`, `server/src/config/env.js`, `client/src/components/Receipts.jsx`, `client/src/pages/Agent.jsx`, tests `server/test/executor/tick.test.js` (22), `server/test/fork/executor.fork.test.js` (7). Tests: verify pass (138), fork 18. Tx hashes: none. Env (names): `EXECUTOR_MODE` (optional; unset = dry). Limits: no real refill yet; spender not deployed and has 0 ETH. Next: Checkpoint B, then owner stop.
- **2026-11-25 — Checkpoint B (fresh-eyes review, separate agent).** No path found that sells at a bad price, over a limit, to the wrong place, twice, while paused or in dry mode. Findings fixed: (1, high) live mode now only for `LIVE_USER_ADDRESSES` with a $1 cap; (2) fresh chain time per agent and for the deadline; (3) CDP idempotency key as UUID v4; (4) settle reads our own user-op success, counts only pool → agent USDC, unclear results stay locked with an alert; (5) hash-save failure logged + alerted; (6) agent/user re-read under the lock; (7) decimals read on chain each tick. Deferred to Checkpoint C: (8) restrict permission signers to Coinbase Smart Wallet / 7702; (9) alert after 3 simulation failures. 14 new tests. verify pass (152), fork 18.
- **2026-11-25 — Owner dry run #1:** blocked `allowance_exhausted`. Cause: dry runs didn't apply the $1 rollout cap, so it planned ~$1.97 = 0.0134 NVDAc, over the 0.01/day permission. Fix: rollout cap applies in dry too; refill shrinks to fit the allowance left. Spender gas confirmed: 0.0005 ETH at `0xb7F3…d15B`. 2 regression tests; verify pass (154).
- **2026-11-25 — Owner live tick #1:** `skipped refill_in_flight`, nothing sent (checked on chain: spender still 0.0005 ETH and undeployed, owner NVDAc 0.02065741 unchanged, agent USDC 0). Cause: the dry run and the live run were in the same 5-minute window and shared the refill id. Fix: id includes the mode; clearer skip reason. 2 regression tests; verify pass (156).

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
