// GET /v1/refills (PRD §14): receipts and decisions for the signed-in user's agents.
import { Router } from 'express';
import { HoldtilError } from '../errors.js';
import { requireUser } from '../auth/session.js';
import { REFILLS } from '../db/refills.js';
import { CODES } from '../errors.js';

const PAGE = 20;
const MONEY = ['plannedUsdc', 'stockAmount', 'quotedOut', 'minOut', 'simulatedUsdcOut', 'usdcOut', 'maxPayoutUsdc', 'refPrice', 'quotePrice', 'gapBps', 'refPriceAt', 'feeStockAmount', 'feeMinOut', 'simulatedFeeOut', 'feeUsdcOut'];

export function publicRefill(r) {
  const out = {
    refillId: r.refillId,
    agentId: r.agentId,
    state: r.state,
    stock: r.stock ?? 'NVDAc', // refills before multi-stock were all NVDAc
    code: r.code ?? null,
    nextAction: r.code ? CODES[r.code]?.nextAction ?? null : null,
    reason: r.history?.at(-1)?.note ?? null,
    mode: r.mode ?? null,
    txHash: r.txHash ?? null,
    userOpHash: r.userOpHash ?? null,
    createdAt: r.createdAt,
    history: (r.history ?? []).map((h) => ({ from: h.from, to: h.to, at: h.at, code: h.code })),
  };
  for (const k of MONEY) out[k] = r[k] === undefined || r[k] === null ? null : String(r[k]);
  return out;
}

export function refillRoutes({ db }) {
  const r = Router();
  r.use(requireUser(db));
  r.get('/', async (req, res) => {
    const agents = await db.collection('agents').find({ userId: String(req.user._id) }).project({ _id: 1 }).toArray();
    const mine = agents.map((a) => String(a._id));
    let ids = mine;
    if (req.query.agentId !== undefined) {
      if (typeof req.query.agentId !== 'string' || !mine.includes(req.query.agentId)) throw new HoldtilError('not_found', 'Agent not found', { status: 404 });
      ids = [req.query.agentId];
    }
    const page = Math.max(0, Math.min(1000, Number.parseInt(req.query.page ?? '0', 10) || 0));
    const list = await db.collection(REFILLS).find({ agentId: { $in: ids } }).sort({ createdAt: -1 }).skip(page * PAGE).limit(PAGE).toArray();
    res.json({ refills: list.map(publicRefill), page });
  });
  return r;
}
