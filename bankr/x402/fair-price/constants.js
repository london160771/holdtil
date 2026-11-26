// Addresses and settings for the fair-price check. Same values as server/src/config/addresses.js and
// server/src/config/executor.js (official sources are linked there); test/sync.test.js fails on any difference.
export const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const AERO_CL_QUOTER = '0x514c8B5f54112481E28028F1166Bd78501089259';

export const STOCKS = Object.freeze({
  NVDAc: Object.freeze({
    symbol: 'NVDAc',
    address: '0xb20000000000000000000078ee7ce2fE4908108C',
    feed: '0x04689a41629776563E6822F76f2e57D148d28513',
    feedName: 'Chainlink "Coinbase NVDA" (24/5)',
    pool: Object.freeze({ address: '0x853F5f1B92b16714Fe6CDA67CAad0856B83C7ab9', tickSpacing: 10, venue: 'Aerodrome Slipstream' }),
  }),
});

// Holdtil's own refill settings (server/src/config/executor.js).
export const RULE = Object.freeze({
  maxPriceAgeSec: 3600n,
  maxFutureSkewSec: 30n,
  maxGapBps: 100n,
  slippageBps: 50n,
  bufferBps: 50n,
});

export const feedAbi = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  {
    type: 'function',
    name: 'latestRoundData',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
];

export const erc20DecimalsAbi = [{ type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }];

export const quoterAbi = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
];
