// A fake viem client for the fair-price check. Values look like real Base reads (NVDAc 8 dec, USDC 6, feed 8).
import { usdcValue } from '../x402/fair-price/lib/refillPlanner.js';

export const REF = 15354255219n; // $153.54255219
export const NOW = 1_764_000_000n;

export function fakeClient({ ref = REF, updatedAt = NOW - 600n, roundId = 10n, answeredInRound = 10n, gapBps = 30n, below = true, failRead = false, failQuote = false, quoteZero = false } = {}) {
  const calls = [];
  return {
    calls,
    async readContract({ functionName, address }) {
      calls.push(functionName);
      if (failRead) throw new Error('rpc down');
      if (functionName === 'decimals') return address.toLowerCase().startsWith('0x8335') ? 6 : 8;
      if (functionName === 'latestRoundData') return [roundId, ref, updatedAt, updatedAt, answeredInRound];
      throw new Error(`unexpected ${functionName}`);
    },
    async getBlock() {
      return { number: 38_000_000n, timestamp: NOW };
    },
    async simulateContract({ args }) {
      if (failQuote) throw new Error('quote reverted');
      if (quoteZero) return { result: [0n, 0n, 0, 0n] };
      const atRef = usdcValue({ stockAmount: args[0].amountIn, price: ref > 0n ? ref : REF, tokenDecimals: 8, usdcDecimals: 6, priceDecimals: 8 });
      const out = below ? (atRef * (10_000n - gapBps)) / 10_000n : (atRef * (10_000n + gapBps)) / 10_000n;
      return { result: [out, 0n, 0, 0n] };
    },
  };
}
