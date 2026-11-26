// POST /internal/checks (PRD §14, FR-FPC-001): the Bankr-hosted fair-price check records each answered
// check here so /proof can show it. Secret header; strict shape; public facts only. Never moves money.
import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { HoldtilError } from '../errors.js';

const digest = (s) => createHash('sha256').update(String(s)).digest();
const ADDR = /^0x[0-9a-f]{40}$/;
const USD = /^\d{1,4}(\.\d{1,8})?$/;
const REASONS = new Set(['price_stale', 'price_gap_too_wide']);

/** Validates one record. Returns the document to store, or throws invalid_input. */
export function parseCheck(b) {
  const bad = (m) => new HoldtilError('invalid_input', m, { status: 400 });
  if (!b || typeof b !== 'object') throw bad('body must be an object');
  if (typeof b.checkId !== 'string' || !/^[0-9a-f-]{36}$/.test(b.checkId)) throw bad('checkId');
  if (b.payer !== null && !(typeof b.payer === 'string' && ADDR.test(b.payer))) throw bad('payer');
  if (b.stock !== 'NVDAc') throw bad('stock');
  if (typeof b.forUsdc !== 'string' || !USD.test(b.forUsdc)) throw bad('forUsdc');
  if (b.verdict !== 'sell' && b.verdict !== 'wait') throw bad('verdict');
  if (b.verdict === 'sell' ? b.reason !== null : !REASONS.has(b.reason)) throw bad('reason');
  for (const k of ['gapBps', 'ageSec']) if (b[k] !== null && !(Number.isInteger(b[k]) && b[k] >= 0 && b[k] < 1e9)) throw bad(k);
  if (b.refUsd !== null && !(typeof b.refUsd === 'string' && USD.test(b.refUsd))) throw bad('refUsd');
  if (!Number.isInteger(b.block) || b.block <= 0) throw bad('block');
  const at = new Date(b.checkedAt);
  if (typeof b.checkedAt !== 'string' || Number.isNaN(at.getTime())) throw bad('checkedAt');
  return {
    checkId: b.checkId,
    payer: b.payer,
    stock: b.stock,
    forUsdc: b.forUsdc,
    verdict: b.verdict,
    reason: b.reason,
    gapBps: b.gapBps,
    refUsd: b.refUsd,
    ageSec: b.ageSec,
    block: b.block,
    checkedAt: at,
  };
}

export function checkRoutes({ db, config }) {
  const r = Router();
  r.post('/checks', async (req, res) => {
    const given = req.get('x-check-secret') ?? '';
    if (!config.checkSecret || !timingSafeEqual(digest(given), digest(config.checkSecret))) {
      throw new HoldtilError('auth_failed', 'Bad check secret', { status: 401 });
    }
    const doc = parseCheck(req.body);
    // Same checkId twice (a retry) stores once.
    await db.collection('fairPriceChecks').updateOne({ checkId: doc.checkId }, { $setOnInsert: { ...doc, createdAt: new Date() } }, { upsert: true });
    res.status(201).json({ ok: true });
  });
  return r;
}
