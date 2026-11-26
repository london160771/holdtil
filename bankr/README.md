# Holdtil fair-price check (Bankr x402 Cloud)

A paid API ($0.01 USDC per call on Base) that answers one question before an agent sells a tokenized stock:
**is the Chainlink price fresh, and is the pool within 1% of it?** Same rule and code as Holdtil's refills (PRD FR-FPC-001).

```
GET https://x402.bankr.bot/<wallet>/fair-price?stock=NVDAc&usdc=1
→ { "verdict": "sell", "gapBps": 10, "sell": { "stockAmount": "0.00707554", "minUsdcOut": "0.999034" }, "reference": {...}, "pool": {...} }
→ { "verdict": "wait", "reason": "price_stale", "detail": "reference is 172800s old", ... }
```

- Read-only. It never trades, holds or moves funds.
- Bad input answers 400 and chain trouble 503, so the caller isn't charged.
- `lib/` holds exact copies of `server/src/core` (`npm run bankr:sync`); `test/sync.test.js` fails if they drift.
- Deploy (owner only): see PROJECT_STATE §1 "P5-BANKR".

## Holdtil skill for Bankr agents

`skills/holdtil/` is a Bankr skill: a Bankr agent keeps its budget in NVDAc, and on "holdtil refill" it pays the check above and sells with Bankr's own swap only at or above `sell.fairFloorUsdc`. Install in Bankr chat: `install the skill at https://github.com/london160771/holdtil/tree/main/bankr/skills/holdtil`. Owner test: PROJECT_STATE §1 "P5-BANKR-SKILL".
