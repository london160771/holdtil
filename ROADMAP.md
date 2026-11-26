# ROADMAP — Holdtil

> The parking lot. Any idea not in the current PRD scope goes here — never into the build.
> Nothing here gets built until it moves into `PRD.md` (§26 scope + §27 phases) with the owner's approval.

---

## 1. How to use this file

- **Agents:** when an idea comes up mid-phase, add one row to §2 and mention it in the phase report. Do not build it.
- **Adesope:** review after submission. Promote an idea by adding it to the PRD, then delete its row here.

## 2. Parked ideas

| Date | Idea | Why it came up | Why parked | Value later (H/M/L) |
|---|---|---|---|---|
| 2026-11-24 | USDC reserve fallback when stock price is unfair and float is critical | Weekend gaps | P1 (FR-RSV-001) | H |
| 2026-11-26 | Even more stocks: MSTRc, SPCXc, SNDKc also have a feed and a pool (checked 2026-11-26) | Multi-stock build | Kept to six well-known names for launch | L |
| 2026-11-24 | Alerts by email/Telegram | Owners want to know about waits | P1 (FR-ALR-001) | M |
| 2026-11-24 | SDK / plugins for agent frameworks (ElizaOS, AgentKit, Bankr) | Easier adoption | Zero-integration is enough for v1 | H |
| 2026-11-24 | Agents that earn: sweep agent income into stocks (receive side) | Research-to-Treasury does this | Out of scope; spending side only | M |
| 2026-11-24 | Pay fee for Holdtil (small % per refill) | Business model | Not needed for v1 | M |

## 3. After the hackathon / next version

**Next:**
1. USDC reserve fallback
2. More stocks + mixed baskets
3. Agent framework plugins

**Later:**
- Teams: several owners managing a shared agent budget
- Other tokenized assets (gold, treasuries) as treasury options

**Probably never:**
- Lending or leverage — adds risk and licensing burden.
- Own token — not needed.

## 4. Future story (H)

- **Who will need this next:** every agent on Base that earns or spends money.
- **Funding or follow-on:** Base Ecosystem Fund, Builder Grants [ ]
- **What we'd say to judges:** "Every agent needs somewhere to keep its money between payments. Holdtil makes that place invested and safe."
