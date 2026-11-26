// Every contract Holdtil may call on Base mainnet (PRD §11 INV-6, CLAUDE.md §6 "Addresses").
// Each address comes from an official source, linked beside it, and was checked on 2026-11-24.
// Do not add an address without an official source link and a re-check on chain.

export const CHAIN_ID = 8453; // Base mainnet

export const ADDRESSES = Object.freeze({
  // Coinbase Tokenized Stock (B20 native precompile; holds no bytecode).
  // Sources: https://www.base.org/stocks (NVDAc → basescan link)
  //          https://api.coinbase.com/v1/tokenized-stocks (symbol NVDAc, decimals 8)
  NVDAc: '0xb20000000000000000000078ee7ce2fE4908108C',

  // Native USDC on Base (Circle).
  // Source: https://developers.circle.com/stablecoins/usdc-contract-addresses
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',

  // Chainlink "Coinbase NVDA" feed, 24/5 total-return reference value, 8 decimals.
  // Sources: https://api.coinbase.com/v1/tokenized-stocks/nav-feeds (NVDAc → this feed)
  //          https://docs.chain.link/data-feeds/price-feeds/addresses?network=base (path cbnvda-usd)
  NVDA_USD_FEED: '0x04689a41629776563E6822F76f2e57D148d28513',

  // More Coinbase Tokenized Stocks with a Chainlink "Coinbase <TICKER>" feed (owner-approved 2026-11-26, PRD §16).
  // Sources: https://api.coinbase.com/v1/tokenized-stocks (symbol, address, decimals 8)
  //          https://api.coinbase.com/v1/tokenized-stocks/nav-feeds (token → feed)
  // Checked on chain 2026-11-26: decimals() = 8 for each token; feed description() = "Coinbase <TICKER>", 8 decimals.
  AAPLc: '0xb200000000000000000000C2e324d24d7eEcd1fb',
  AAPL_USD_FEED: '0x787f13dEa48Db0897CbCDD985de77809D837F988',
  TSLAc: '0xb2000000000000000000001e800a7f5189430cD0',
  TSLA_USD_FEED: '0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4',
  METAc: '0xb2000000000000000000008bC8786B856E61707C',
  META_USD_FEED: '0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D',
  GOOGLc: '0xb2000000000000000000002D0BA3164cc74f58B7',
  GOOGL_USD_FEED: '0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2',
  MSFTc: '0xB200000000000000000000Ab99cFa739E253872B',
  MSFT_USD_FEED: '0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c',

  // Spend Permission Manager + its ERC-6492 validator (same address on all chains).
  // Source: https://github.com/coinbase/spend-permissions#deployments
  //         (linked from https://docs.cdp.coinbase.com/coinbase-wallet/improve-ux/spend-permissions)
  SPEND_PERMISSION_MANAGER: '0xf85210B21cC50302F477BA56686d2019dC9b67Ad',
  PUBLIC_ERC6492_VALIDATOR: '0xcfCE48B757601F3f351CB6f434CB0517aEEE293D',

  // Coinbase Smart Wallet v1.1 factory (Base Account / CDP smart accounts).
  // Source: https://github.com/coinbase/smart-wallet#deployments
  SMART_WALLET_FACTORY: '0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842',

  // Aerodrome Slipstream "Gauges V3 Deployment" (the factory that holds the deep NVDAc/USDC pool).
  // Source: https://github.com/aerodrome-finance/slipstream#deployments
  AERO_CL_FACTORY: '0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef',
  AERO_CL_SWAP_ROUTER: '0x698Cb2b6dd822994581fEa6eA4Fc755d1363A92F',
  AERO_CL_QUOTER: '0x514c8B5f54112481E28028F1166Bd78501089259',
});

// Pools are not listed by Aerodrome docs; they are derived on chain from the official factory:
//   AERO_CL_FACTORY.getPool(NVDAc, USDC, tickSpacing) — checked 2026-11-24.
export const POOLS = Object.freeze({
  NVDAc_USDC: {
    address: '0x853F5f1B92b16714Fe6CDA67CAad0856B83C7ab9',
    factory: ADDRESSES.AERO_CL_FACTORY,
    tickSpacing: 10,
    fee: 500, // 0.05%, read from pool.fee()
  },
  // Same factory, tickSpacing 10, fee 500 (read from pool.fee()). USDC in pool on 2026-11-26 (balanceOf):
  // AAPLc 46.8k, TSLAc 19.7k, METAc 16.9k, GOOGLc 11.8k, MSFTc 7.6k. $1–$25 sell quotes were 18–59 bps from Chainlink.
  AAPLc_USDC: { address: '0xA3b1E3f9747065e2073722Ff4c9027d3eA4994F0', factory: ADDRESSES.AERO_CL_FACTORY, tickSpacing: 10, fee: 500 },
  TSLAc_USDC: { address: '0x469337fDcc5E8f38e2E4B670B04F57865D13a7BB', factory: ADDRESSES.AERO_CL_FACTORY, tickSpacing: 10, fee: 500 },
  METAc_USDC: { address: '0xEAF57753BC382E0324a1D43F72E7027705a2273E', factory: ADDRESSES.AERO_CL_FACTORY, tickSpacing: 10, fee: 500 },
  GOOGLc_USDC: { address: '0xB1987CAD1682841b4b641d50E520777eC5Ab5542', factory: ADDRESSES.AERO_CL_FACTORY, tickSpacing: 10, fee: 500 },
  MSFTc_USDC: { address: '0x7103eB3c9590d1281f7dc03b2A9EE27C39dF5D54', factory: ADDRESSES.AERO_CL_FACTORY, tickSpacing: 10, fee: 500 },
});

// Stock tokens Holdtil may sell. NVDAc is the default; the rest were added 2026-11-26 (PRD §16, FR-STK-001).
// decimals: read on chain; money paths re-read decimals on chain every tick.
export const STOCKS = Object.freeze({
  NVDAc: { symbol: 'NVDAc', name: 'NVIDIA', address: ADDRESSES.NVDAc, decimals: 8, feed: ADDRESSES.NVDA_USD_FEED, pool: POOLS.NVDAc_USDC },
  AAPLc: { symbol: 'AAPLc', name: 'Apple', address: ADDRESSES.AAPLc, decimals: 8, feed: ADDRESSES.AAPL_USD_FEED, pool: POOLS.AAPLc_USDC },
  TSLAc: { symbol: 'TSLAc', name: 'Tesla', address: ADDRESSES.TSLAc, decimals: 8, feed: ADDRESSES.TSLA_USD_FEED, pool: POOLS.TSLAc_USDC },
  METAc: { symbol: 'METAc', name: 'Meta', address: ADDRESSES.METAc, decimals: 8, feed: ADDRESSES.META_USD_FEED, pool: POOLS.METAc_USDC },
  GOOGLc: { symbol: 'GOOGLc', name: 'Alphabet', address: ADDRESSES.GOOGLc, decimals: 8, feed: ADDRESSES.GOOGL_USD_FEED, pool: POOLS.GOOGLc_USDC },
  MSFTc: { symbol: 'MSFTc', name: 'Microsoft', address: ADDRESSES.MSFTc, decimals: 8, feed: ADDRESSES.MSFT_USD_FEED, pool: POOLS.MSFTc_USDC },
});

export const DEFAULT_STOCK = 'NVDAc';

/** The stock an agent is refilled from. Old agents have no field = NVDAc. Unknown symbol → null (fail closed). */
export function stockOf(agent) {
  const sym = agent?.stock ?? DEFAULT_STOCK;
  return Object.hasOwn(STOCKS, sym) ? STOCKS[sym] : null;
}

const allowed = new Set(
  [...Object.values(ADDRESSES), ...Object.values(POOLS).map((p) => p.address)].map((a) => a.toLowerCase()),
);

/** True only for an address in the INV-6 allowlist. */
export function isAllowlisted(address) {
  return typeof address === 'string' && allowed.has(address.toLowerCase());
}
