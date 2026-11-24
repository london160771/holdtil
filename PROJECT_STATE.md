# PROJECT_STATE — Holdtil

> Where the project actually stands. A progress log, not requirements (those live in `PRD.md`).
> Update at the end of every phase. Only write what was verified. If this file and the repo disagree, the repo wins.

**Last updated:** 2026-11-24 17:00 WAT · **By:** Claude · **Commit:** `[none yet]`

---

## 1. Right now

- **Active phase:** Phase 0 — Foundation + Gate 0 (PRD §27), not started
- **Status:** Docs written; waiting on owner manual tasks
- **Next step:** Owner completes the manual tasks in §11 below, then Claude starts Phase 0
- **Blocked by:** Manual tasks M1–M8 (§11)

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

- Eligibility to hold Coinbase tokenized stocks from Nigeria not yet confirmed (PRD §33 #1).

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
| M2 | Check you can hold NVDAc from Nigeria | ⬜ |
| M3 | Create the GitHub repo | ⬜ |
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
4. Put it in `server/.env` as `MONGODB_URI=` (Claude will create the `.env.example`). Do not paste it in chat.
5. Check it worked: Claude's health check will report "db: ok".

**M5 — Coinbase Developer Platform**
1. Sign in at portal.cdp.coinbase.com → create a project.
2. API Keys → create a **Secret API key** → save the key ID and secret. Also create a **Wallet Secret** (Server Wallet).
3. Put them in `server/.env` as `CDP_API_KEY_ID=`, `CDP_API_KEY_SECRET=`, `CDP_WALLET_SECRET=`. Do not paste them in chat.
4. Check it worked: Claude's Gate 0 script will create the spender account and print only its public address.

**M6 — Base RPC URL**
1. Easiest: in the CDP portal, open Node → copy your Base mainnet RPC URL.
2. Put it in `server/.env` as `BASE_RPC_URL=`.
3. Check it worked: Claude's script prints the latest Base block number.

**M7 — X account**
1. Check x.com/holdtil is free. If yes, create it with the same email you'll use for the project.
2. Bio: "Your agent's money stays invested until it pays. Built on @base."
3. Tell Claude the handle (or a backup handle if taken).

**M8 — Domain (later)**
1. Buy `holdtil.xyz` (~$1.49 first year) on Vercel Domains or another registrar.
2. In Phase 5 Claude will give you a short guide to point it at the Vercel project.
