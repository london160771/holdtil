// Builds the "earned while waiting" figures for one user from DB + chain (PRD §16). Display only.
// Unknown inputs → that stock's entry says "unavailable"; nothing is guessed.
import { getAddress } from 'viem';
import { REFILLS } from '../db/refills.js';
import { STOCKS } from '../config/addresses.js';
import { earnedWhileWaiting } from '../core/earned.js';

const BY_ADDRESS = new Map(Object.values(STOCKS).map((s) => [s.address.toLowerCase(), s]));
// Refills before multi-stock didn't store the stock; they were all NVDAc.
export const stockOfRefill = (r) => r.stock ?? 'NVDAc';

/** Earliest known start price for a stock: a permission's price at signing, or else the first confirmed refill's reference. */
function startPoint(perms, refills) {
  const fromPerm = perms
    .filter((p) => p.startRefPrice && p.startRefAt)
    .map((p) => ({ price: BigInt(p.startRefPrice), at: new Date(p.startRefAt), source: 'permission' }));
  const fromRefill = refills
    .filter((r) => r.refPrice && r.createdAt)
    .map((r) => ({ price: BigInt(r.refPrice), at: new Date(r.createdAt), source: 'first_refill' }));
  return [...fromPerm, ...fromRefill].sort((a, b) => a.at - b.at)[0] ?? null;
}

/**
 * @param {{ db, chain, userId: string, userAddress: string }} p
 * @returns {Promise<object[]>} one entry per stock the user has a permission for
 */
export async function earnedForUser({ db, chain, userId, userAddress }) {
  const perms = await db.collection('permissions').find({ userId }).toArray();
  const tokens = [...new Set(perms.map((p) => p.token?.toLowerCase()).filter((t) => BY_ADDRESS.has(t)))];
  if (tokens.length === 0) return [];
  const agentIds = (await db.collection('agents').find({ userId }).project({ _id: 1 }).toArray()).map((a) => String(a._id));
  const confirmed = agentIds.length ? await db.collection(REFILLS).find({ agentId: { $in: agentIds }, state: 'confirmed' }).sort({ createdAt: 1 }).toArray() : [];

  return Promise.all(
    tokens.map(async (t) => {
      const stock = BY_ADDRESS.get(t);
      const sales = confirmed.filter((r) => stockOfRefill(r) === stock.symbol && r.stockAmount && r.usdcOut);
      const start = startPoint(perms.filter((p) => p.token.toLowerCase() === t), sales);
      const base = { symbol: stock.symbol, since: start?.at ?? null, startSource: start?.source ?? null };
      if (!start) return { ...base, status: 'no_start', note: 'Starts with your first refill' };
      const after = sales.filter((r) => new Date(r.createdAt) >= start.at);
      const soldStock = after.reduce((s, r) => s + BigInt(r.stockAmount), 0n);
      const usdcFromSales = after.reduce((s, r) => s + BigInt(r.usdcOut), 0n);
      try {
        const [held, ref, decimals] = await Promise.all([chain.readStockBalance(stock.address, getAddress(userAddress)), chain.readReference(stock), chain.readDecimals(stock.address)]);
        if (ref.answer <= 0n) throw new Error('no price');
        const e = earnedWhileWaiting({ heldStock: held, soldStock, usdcFromSales, startPrice: start.price, nowPrice: ref.answer, tokenDecimals: decimals, priceDecimals: ref.decimals });
        return {
          ...base,
          status: 'ok',
          decimals,
          heldStock: held.toString(),
          soldStock: soldStock.toString(),
          usdcFromSales: usdcFromSales.toString(),
          startPrice: start.price.toString(),
          nowPrice: ref.answer.toString(),
          nowPriceAt: new Date(Number(ref.updatedAt) * 1000),
          priceDecimals: ref.decimals,
          keptUsdc: e.keptUsdc.toString(),
          idleUsdc: e.idleUsdc.toString(),
          earnedUsdc: e.earnedUsdc.toString(),
          earnedBps: e.earnedBps === null ? null : e.earnedBps.toString(),
        };
      } catch {
        return { ...base, status: 'unavailable' };
      }
    }),
  );
}
