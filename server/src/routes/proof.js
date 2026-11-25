// GET /v1/proof (PRD §14, FR-PRF-001): public, no login. Holdtil Scout's real x402 payments and the
// refills Holdtil made for Scout's wallet. Only public on-chain facts; no user ids, no other users' data.
import { Router } from 'express';
import { getAddress, isAddress } from 'viem';
import { REFILLS } from '../db/refills.js';
import { publicRefill } from './refills.js';

const LIMIT = 30;

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
    }));

    let refills = [];
    let usdcBalance = null;
    if (scout) {
      // scout is a checksummed hex address, so it is safe inside a regex.
      const agents = await db.collection('agents').find({ walletAddress: { $regex: `^${scout}$`, $options: 'i' } }).project({ _id: 1 }).toArray();
      const ids = agents.map((a) => String(a._id));
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
    const paid = payments.filter((p) => p.txHash);
    const confirmed = refills.filter((x) => x.state === 'confirmed');
    res.json({
      scout: scout ? { address: scout, usdcBalance } : null,
      totals: {
        payments: paid.length,
        paidUsdc: paid.reduce((s, p) => s + BigInt(p.costUsdc ?? '0'), 0n).toString(),
        refills: confirmed.length,
        refilledUsdc: confirmed.reduce((s, x) => s + BigInt(x.usdcOut ?? '0'), 0n).toString(),
        window: `latest ${LIMIT}`,
      },
      payments,
      refills,
    });
  });
  return r;
}
