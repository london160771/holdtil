// GET /v1/proof (PRD §14, FR-PRF-001): public, no login. Holdtil Scout's real x402 payments and the
// refills Holdtil made for Scout's wallet. Only public on-chain facts; no user ids, no other users' data.
import { Router } from 'express';
import { getAddress, isAddress } from 'viem';
import { REFILLS } from '../db/refills.js';
import { publicRefill } from './refills.js';
import { publicMarketStatus } from '../core/marketHours.js';

const LIMIT = 30;

/** Seller host and item name from the URL Scout paid for (spending log). Unknown → nulls, never a guess. */
export function whatWasBought(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return { seller: null, item: null };
    return { seller: u.hostname, item: u.pathname.split('/').filter(Boolean).at(-1) ?? null };
  } catch {
    return { seller: null, item: null };
  }
}

export function proofRoutes({ db, config, chain }) {
  const r = Router();
  r.get('/', async (_req, res) => {
    const scout = config.scoutAddress && isAddress(config.scoutAddress, { strict: false }) ? getAddress(config.scoutAddress) : null;
    const runs = await db.collection('scoutRuns').find({ status: { $ne: 'pending' } }).sort({ createdAt: -1 }).limit(LIMIT).toArray();
    const payments = runs.map((x) => ({
      at: x.createdAt,
      status: x.status,
      costUsdc: x.costUsdc ?? null,
      txHash: x.x402TxHash ?? null,
      summary: x.summary ?? null,
      ...whatWasBought(x.url),
      payTo: x.payTo ?? null,
    }));

    let refills = [];
    let usdcBalance = null;
    if (scout) {
      // scout is a checksummed hex address, so it is safe inside a regex.
      // Only the FIRST agent registered for Scout's wallet (the owner's). Anyone else adding the same address
      // can't put rows on the public page (Checkpoint C #7).
      const first = await db.collection('agents').find({ walletAddress: { $regex: `^${scout}$`, $options: 'i' } }).sort({ createdAt: 1, _id: 1 }).limit(1).project({ _id: 1 }).toArray();
      const ids = first.map((a) => String(a._id));
      const list = ids.length ? await db.collection(REFILLS).find({ agentId: { $in: ids } }).sort({ createdAt: -1 }).limit(LIMIT).toArray() : [];
      refills = list.map((x) => {
        const p = publicRefill(x);
        delete p.agentId;
        delete p.refillId;
        return p;
      });
      try {
        usdcBalance = (await chain.readUsdcBalance(scout)).toString();
      } catch {
        usdcBalance = 'unavailable';
      }
    }
    // Fair-price checks answered on Bankr (FR-FPC-001). Payments settle at Bankr after the answer, so we link the
    // payout wallet on BaseScan instead of claiming a tx per check.
    const checkDocs = await db.collection('fairPriceChecks').find({}).sort({ createdAt: -1 }).limit(LIMIT).toArray();
    const checks = checkDocs.map((c) => ({
      at: c.checkedAt,
      payer: c.payer ?? null,
      stock: c.stock,
      forUsdc: c.forUsdc,
      verdict: c.verdict,
      reason: c.reason ?? null,
      gapBps: c.gapBps ?? null,
      refUsd: c.refUsd ?? null,
      ageSec: c.ageSec ?? null,
      block: c.block,
    }));
    const checkCount = await db.collection('fairPriceChecks').estimatedDocumentCount();
    const fairPrice = config.fairPriceUrl
      ? { url: config.fairPriceUrl, payoutWallet: getAddress(config.fairPriceUrl.split('/')[3]), priceUsdc: '0.01', answered: checkCount }
      : null;
    const paid = payments.filter((p) => p.txHash);
    const confirmed = refills.filter((x) => x.state === 'confirmed');
    res.json({
      scout: scout ? { address: scout, usdcBalance } : null,
      market: publicMarketStatus(new Date()),
      totals: {
        payments: paid.length,
        paidUsdc: paid.reduce((s, p) => s + BigInt(p.costUsdc ?? '0'), 0n).toString(),
        refills: confirmed.length,
        refilledUsdc: confirmed.reduce((s, x) => s + BigInt(x.usdcOut ?? '0'), 0n).toString(),
        window: `latest ${LIMIT}`,
      },
      payments,
      refills,
      fairPrice,
      checks,
    });
  });
  return r;
}
