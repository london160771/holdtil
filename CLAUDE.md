# CLAUDE.md — Holdtil

> Single rules file for every agent. Claude Code reads it automatically. Codex reads AGENTS.md by default, so start Codex prompts with "Read CLAUDE.md and PRD.md first."
> Point to PRD sections, don't copy them. Use simple words in everything you write.

## 1. What this is

**Holdtil** — lets AI agent owners keep their agent's money in tokenized stocks on Base and pay the agent's x402 bills from it, selling only at fair prices and only within the owner's limits.
Tagline: "Your agent's budget stays invested until it pays."
Hackathon: Base Stocks Maxxing — Agentic Stock Finance. Deadline: 2026-12-12 (see PRD header). **Internal cutoff: 2026-12-11, 12:00 WAT.**

Flow: `FUND WITH STOCK → AGENT PAYS → FLOAT RUNS LOW → FAIR-PRICE REFILL → PRICE OFF? WAIT → OWNER STOPS IT ANYTIME`
Core guarantee: **Never sell a user's stock unless the price is fresh, fair and within the user's limits. Otherwise wait.**

**This is a real product with real money on Base mainnet.** Real users sign up and use it. Be slow and careful. Section 6 is not optional.

## 2. Source of truth

1. `PRD.md` — the only source of truth for requirements. Read the section before building. Cite it (e.g. "PRD §11").
2. `PROJECT_STATE.md` — what is actually done. Progress log, not requirements.
3. The code. The repo is the final truth; another agent's summary is not.

- If a library, chain, API or tool behaves differently from the PRD, stop, fix the PRD with raw evidence (versions, output, tx hash), log it in PRD §16.
- If a request conflicts with the PRD, update the PRD first. Never silently change scope.
- Update `PROJECT_STATE.md` at the end of every phase.

## 3. Resolved decisions

Live in **PRD §16**. Treat as settled. Reopen only with new evidence.

## 4. Commands

Run from the repo root. Never guess a command — read `package.json`. Node ≥ 22. Workspaces: `server/`, `client/`, `scout/`, `bankr/` (fair-price check for Bankr x402 Cloud).

```bash
npm install            # install all workspaces
npm run dev            # API on :3001 + client on :5173
npm test               # unit + API tests (no network)
npm run test:fork      # Base mainnet state via eth_simulateV1 + live fair-price read (needs BASE_RPC_URL + network; sends nothing)
npm run gate0          # full Gate 0 report as JSON (needs BASE_RPC_URL; CDP keys for the spender step)
npm run lint           # zero warnings
npm run build          # production build (client)
npm run verify         # lint + test + build — the gate
npm run tick           # one executor tick by hand (reads server/.env; dry unless EXECUTOR_MODE=live)
npm run scout          # one Holdtil Scout run (reads scout/.env; dry unless SCOUT_MODE=live)
npm run scout:new-key  # create Scout's wallet key in scout/.env (prints the address only)
npm run scout:sweep    # move Scout's USDC to SWEEP_TO (dry unless -- --send)
npm run spender -- info|sweep [--send]   # spender address/ETH; sweep ETH to SWEEP_TO (spender:prod reads server/.env.prod)
npm run bankr:sync     # copy server/src/core price rules into bankr/x402/fair-price/lib (a test fails if they drift)
```

## 5. Scope

P0 / P1 / Never: **PRD §26**. Screens: **PRD §21**. Endpoints: **PRD §14**.
- Not in the core flow → don't build it. New ideas → `ROADMAP.md`, then move on.
- No extra screens or endpoints. One complete slice beats five half-features.

## 6. Real money rules (no exceptions)

**Custody**
- Holdtil never holds user funds or user keys. Users keep funds in their own Base Account; Holdtil only uses the Spend Permission they signed.
- The spender wallet holds only a little ETH for gas. Never user money.

**Keys and secrets**
- Keys live only in env vars, set by the owner by hand. Never commit, print, log or paste them in chat. Separate dev and prod keys.
- Never ask the owner to paste a private key into chat. Tell them which env var to set and where.
- Cloud build sessions get **dev values only** from the Claude Code cloud environment. Prod values live only in Render (server) — see PROJECT_STATE §11 "Where env values go". Tests use an in-memory MongoDB; never connect dev sessions to the prod database.

**Addresses**
- Every contract address (stock tokens, USDC, router, Chainlink feeds, Spend Permission Manager) comes from an official source (base.org/stocks, Coinbase Tokenized Stocks API, Chainlink docs, Base docs), lives in `server/src/config/addresses.js` with the source link beside it.
- Never use an address from a random repo, tweet or AI answer without checking the official source.

**Before every trade**
- Reference price fresh, gap within limit (PRD §11 INV-2). Otherwise wait.
- Limits checked (INV-3). Destination is the DB agent wallet only (INV-5).
- Min-out + deadline on every swap. Simulate first; if it fails, don't send.

**No double spending**
- One refill per agent at a time, enforced by a DB unique index (INV-4). Idempotent refill IDs. Save tx hash before waiting for confirmation.

**Kill switches**
- Global pause, per-user Stop, per-agent pause, and revoked permissions all block the next tick (INV-7).

**Rollout order — never skip a step**
1. Read-only → 2. Dry run (log what it would do) → 3. Fork tests (Base mainnet state via `eth_simulateV1`; Anvil only for non-B20 parts — PRD §16) → 4. Mainnet with $1 limits, owner's account only → 5. Real users with small default limits.

**Human approval**
- The owner approves the **first real mainnet transaction of every new feature**. Stop and ask (section 10).
- Agents never send real-money transactions on their own during development.

## 7. Invariants

All in **PRD §11** (INV-1 to INV-7, state machine, error codes). Every one holds on every request, in order. General rules:
- **Fail closed.** Unknown, stale or unverifiable state = no sale.
- Money is `bigint` in token base units; stored as strings. No floats in money math. USD is display only.
- Check-and-act is atomic; unique indexes do the safety work, not read-then-write.
- Illegal state transitions throw. Every transition is logged.
- Structured errors only: `code`, `retryable`, `nextAction`. No swallowed errors, no silent fallbacks.

## 8. Honesty rules

- Never fabricate data, balances, receipts, tx hashes, test counts, users or screenshots.
- Can't read a value → show "unavailable", never a guess.
- `REAL · BASE MAINNET` banner and `REAL_VS_MOCKED.md` always match reality.
- Every number on screen comes from DB or chain. Same number everywhere (UI, README, video, submission).
- Report test counts only after they pass. Label targets as targets until measured.
- Notices always visible: not for US persons; not financial advice; stocks can go down.

## 9. Framework gotchas (check installed versions first)

- viem: amounts are `bigint`; use `parseUnits`/`formatUnits` with the token's real decimals (read them on-chain, don't assume 18).
- Smart-wallet signatures (Base Account) need ERC-1271/6492-aware verification — use viem's `verifyMessage` via a public client, not plain ECDSA recovery.
- Chainlink tokenized equity feeds are 24/5; check `updatedAt` every time. Weekends = stale = wait.
- B20 stock balances can change with corporate actions (multiplier). Read balances fresh; never cache them for decisions.
- Vite: any `VITE_` env var ships to the browser. Secrets stay server-side, unprefixed.
- Express: async errors must reach the error handler. Check the installed major version.
- Render free tier sleeps; the tick must be safe to run late or twice.
- **B20 stocks are precompiles.** No bytecode (code `0xef`). Anvil forks can't run them (`OpcodeNotFound`). Test B20 flows with `eth_simulateV1` on a real Base node (see `server/scripts/gate0/spend-batch-sim.js`).
- NVDAc has **8 decimals**, USDC 6, the NVDA feed 8. Read decimals on chain anyway.
- Coinbase stock feeds report **total-return value per token** (price × multiplier): compare the feed answer directly to the DEX price per token.
- Spend Permissions: the user's smart wallet must have the Spend Permission Manager as an owner. Spender batch = `approveWithSignature` (first time only) + `spend` + `approve(router)` + `exactInputSingle(recipient = agent wallet, amountOutMinimum)`.
- Smart-wallet signatures: owner signs the wallet's replay-safe hash (EIP-712 "Coinbase Smart Wallet" domain), wrapped as `(ownerIndex, signatureData)`.
- Base Account SDK docs moved to CDP ("Coinbase Wallet SDK"); the package is still `@base-org/account`.
- x402stock.xyz uses x402 **v2** (`payment-required` header, base64 JSON, `exact` scheme, `eip155:8453`). Use `@x402/fetch` + `@x402/evm`.
- CDP SDK reads `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` from env. "Project has no secret" = no Wallet Secret registered in that CDP project.
- ESLint 10 flat config tracks JSX usage itself; no React plugin needed.
- Builder Codes (ERC-8021) go on refill user ops through CDP `sendUserOperation({ dataSuffix })`, built with `ox/erc8021`. x402 payments can't carry one: the facilitator submits them.
- Bankr x402 Cloud: settles the payment only when the handler answers < 400 (so bad input = 400, chain trouble = 503); verified payer in `x-402-payer`; imports outside the service folder are rejected, so `bankr/x402/fair-price/lib` holds exact copies of `server/src/core` (`npm run bankr:sync`). The owner deploys it with `bankr x402 deploy`.

## 10. Workflow — continuous phases, stop only when needed

Build the phases in **PRD §27** back to back. For each phase: name it, state its acceptance criteria, inspect the code, make the smallest change, verify, update `PROJECT_STATE.md`, commit and push, then start the next phase.

**Verify before claiming done:** run `npm run verify` and read the real output (beware `cmd | tail` hiding the exit code). Reproduce bugs before fixing. Screenshot UI at desktop and 390px and look at it.

**STOP and wait for the owner only when:**
1. A manual task is needed (accounts, API keys, env values, wallet funding, buying a domain, X account, form submissions).
2. Deployment is needed — **the owner always deploys; agents never deploy.**
3. The first real mainnet transaction of a new feature is about to be sent.
4. A review checkpoint is reached (section 12).
5. Something contradicts the PRD and needs a decision.

**Every stop must leave a simple guide**, written in the chat AND in `PROJECT_STATE.md` §1 "Blocked by":
- What you need (one line) and why.
- Numbered steps a beginner can follow (where to click, what to copy).
- Exactly which env var name(s) to set and in which file/dashboard — never ask for the value in chat.
- How to check it worked.
- What you'll do next once it's done.

**Phase report** (short, in PROJECT_STATE and chat): files changed; tests run + real results; tx hashes or "none"; env changes (names only); limitations; next phase.

## 11. Demo and recording

Acts in **PRD §22**. Record each act the moment it works. Keep `/proof` live from Phase 4 on. Lab items in **PRD §18** must stay blocked (tests).

## 12. Review checkpoints (stronger model)

- Default implementation: Sonnet 5.5 High sub-agents. Orchestrator: Opus 5.5.
- Fresh-eyes review (an agent that didn't write the code) at:
  - **Checkpoint A** — after Phase 1 (core engine).
  - **Checkpoint B** — after Phase 3 (executor) and before any real user money.
  - **Checkpoint C** — before launch to real users (security review).

## 13. Git

- **Commit and push after every phase** once it passes verification (owner's continuous mode). Plain conventional messages (`feat:`, `fix:`, `docs:`). Report the commit hash.
- Before each phase commit, update the right docs: `PROJECT_STATE.md` always; `PRD.md` only if a requirement or decision changed (log it in §16); `CLAUDE.md` if commands or gotchas changed; `ROADMAP.md` for new ideas; `README.md` + `REAL_VS_MOCKED.md` when what's real changes.
- Never commit secrets or `.env` files. Check `git diff --staged` before every commit.
- No destructive git commands. Don't manufacture history.

## 14. Deadline discipline

After the internal cutoff: fixes only (links, README, video access, secrets). After the deadline: keep it live; no feature commits. Ideas → `ROADMAP.md`.

## 15. Definition of done

Project checklist: **PRD §30**. A phase is done when its PRD §27 acceptance passes, `npm run verify` passes, `PROJECT_STATE.md` is updated, and it is committed and pushed.
