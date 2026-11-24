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
});

// Stock tokens Holdtil may sell (PRD §26: NVDAc first; more are P1).
export const STOCKS = Object.freeze({
  NVDAc: {
    symbol: 'NVDAc',
    address: ADDRESSES.NVDAc,
    feed: ADDRESSES.NVDA_USD_FEED,
    pool: POOLS.NVDAc_USDC,
  },
});

const allowed = new Set(
  [...Object.values(ADDRESSES), ...Object.values(POOLS).map((p) => p.address)].map((a) => a.toLowerCase()),
);

/** True only for an address in the INV-6 allowlist. */
export function isAllowlisted(address) {
  return typeof address === 'string' && allowed.has(address.toLowerCase());
}
