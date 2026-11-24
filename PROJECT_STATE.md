# PROJECT_STATE — Holdtil

> Where the project actually stands. A progress log, not requirements (those live in `PRD.md`).
> Update at the end of every phase. Only write what was verified. If this file and the repo disagree, the repo wins.

**Last updated:** 2026-11-24 17:00 WAT · **By:** Claude · **Commit:** `[none yet]`

---

## 1. Right now

- **Active phase:** Phase 0 — Foundation + Gate 0 (PRD §27), not started
- **Status:** Docs written; waiting on owner manual tasks
- **Next step:** Owner completes the manual tasks in §11 below, then Claude starts Phase 0
- **Blocked by:** M4–M6 env values (needed mid Phase 0). M1 application due Dec 5.

## 2. Phase tracker

| Phase (PRD §27) | Status | Verified on | Commit | Review |
|---|---|---|---|---|
| 0 — Foundation + Gate 0 | Not started | | | Opus review of Gate 0 |
| 1 — Core engine | Not started | | | A |
| 2 — Accounts, agents, permissions | Not started | | | — |
| 3 — Refill executor | Not started | | | B |
| 4 — Holdtil Scout + proof page | Not started | | | — |
| 5 — Product polish + launch | Not started | | | C |
| 6 — Video, X post, submission | Not started | | | — |
| 7 — P1 extras | Not started | | | — |

## 3. Last verification

| Check | Command | Result | Date |
|---|---|---|---|
| Full gate | `npm run verify` | not run yet | |
| Tests | `npm test` | not run yet | |
| Fork tests | `npm run test:fork` | not run yet | |
| UI at 390px | screenshot | not run yet | |

## 4. What works (verified)

- Nothing built yet. Docs only.

## 5. Real vs mocked right now

See `REAL_VS_MOCKED.md`. Nothing built yet.

## 6. Live proof

| Item | Value |
|---|---|
| Live URL | none yet (holdtil.xyz planned) |
| Proof page | none yet |
| Network | Base mainnet (planned) |
| Contracts / addresses | none deployed |
| Real transactions | none yet |

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

## 9. Handoff notes

- **Read first:** `CLAUDE.md`, PRD sections for the active phase, then this file.
- **Branch:** `main` · **Uncommitted work:** docs (first commit pending repo creation)
- **Env vars needed (names only, final list set in Phase 0):** `BASE_RPC_URL`, `MONGODB_URI`, `SESSION_SECRET`, `TICK_SECRET`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`, `SCOUT_PRIVATE_KEY`
- **Watch out for:** real money — follow CLAUDE.md §6.

## 10. Build log

- **2026-11-24** — Project docs created (PRD, CLAUDE, PROJECT_STATE, ROADMAP, README, REAL_VS_MOCKED). Research and idea selection done in chat.

## 11. Manual tasks (owner)

Status: ⬜ to do · ✅ done

| # | Task | Status |
|---|---|---|
| M1 | Apply to Stocks Maxxing (closes Dec 5, 11:59pm EST) | ⬜ |
| M2 | Check you can hold NVDAc from Nigeria | ✅ 2026-11-24 (bought ~$1 on Aerodrome) |
| M3 | Create the GitHub repo | ✅ 2026-11-24 |
| M4 | Create MongoDB Atlas free cluster | ⬜ |
| M5 | Create a Coinbase Developer Platform (CDP) account + API keys | ⬜ |
| M6 | Get a Base mainnet RPC URL | ⬜ |
| M7 | Check @holdtil on X and create it | ⬜ |
| M8 | Buy holdtil.xyz (can wait until Phase 5) | ⬜ |

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
