# How Holdtil's check works

Holdtil is an agent treasury tool on Base (https://github.com/london160771/holdtil). Its one rule: **never sell stock unless the price is fresh and fair, otherwise wait.**

## The paid check

`GET <holdtil_check_url>?stock=NVDAc&usdc=1.50` (or POST JSON `{"stock":"NVDAc","usdc":"1.50"}`), $0.01 USDC on Base over x402, hosted on Bankr x402 Cloud.

It reads, on Base mainnet, at the latest block:
- Chainlink "Coinbase NVDA" feed `0x04689a41629776563E6822F76f2e57D148d28513` (24/5, per-token value).
- A live quote from the deep NVDAc/USDC Aerodrome Slipstream pool `0x853F5f1B92b16714Fe6CDA67CAad0856B83C7ab9`.

Then:
- Reference older than 1 hour, incomplete, or missing → `wait`, `price_stale`.
- Pool price more than 1% (100 bps) from the reference → `wait`, `price_gap_too_wide`.
- Otherwise → `sell`.

### `sell` answer

```json
{
  "verdict": "sell",
  "gapBps": 10,
  "forUsdc": "1.50",
  "sell": { "stockAmount": "0.01061331", "minUsdcOut": "1.498…", "fairFloorUsdc": "1.493…" },
  "reference": { "usd": "142.03886724", "ageSec": 1215, "...": "..." },
  "pool": { "usdcOut": "1.506…", "pricePerToken": "141.9…", "...": "..." }
}
```

- `stockAmount`: NVDAc to sell for `forUsdc`, at the reference price plus 0.5% for fees.
- `fairFloorUsdc`: Chainlink value of `stockAmount` minus 1%. The least any route may pay, after its fees, and still count as fair. **Use this with Bankr's swap.**
- `minUsdcOut`: stricter floor for the Aerodrome pool itself (Holdtil's own refills use it).

### `wait` answer

```json
{ "verdict": "wait", "reason": "price_stale", "detail": "reference is 43630s old", "...": "..." }
```

### Errors (not charged)

- `400 invalid_input`: bad `stock` or `usdc` (0.10 to 1000, max 6 decimals).
- `503 chain_unavailable`: Base could not be read. Try later; never sell on an error.

## Why the floor is enforced as slippage

Bankr's swap takes a slippage tolerance, not a minimum amount. Setting `slippage% = (expected − fairFloorUsdc) / expected` makes Bankr's own minimum equal Holdtil's fair floor, so the swap reverts instead of filling below a fair price.
