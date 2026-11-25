// Holdtil Scout (PRD FR-SCT-001): our own agent. It pays x402stock.xyz for real market data over x402
// (v2, exact scheme, Base USDC) and stores a short summary. Its USDC float is refilled by Holdtil like any agent.
// Fails closed: wrong network/asset, price over the per-call max, or over the daily budget = no payment.
import { randomUUID } from 'node:crypto';

export const URL_TO_CALL = 'https://x402stock.xyz/api/v1/market-pulse';
export const BASE = 'eip155:8453';
export const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
// x402stock.xyz's payTo, seen in its 402 answers since Gate 0 (2026-11-24) and paid in tx 0x57a8130e… (Checkpoint C #10).
export const PAY_TO = '0x3070Fbb3803819fB5BdfE9286fdc6325A877fA85';
export const RUNS = 'scoutRuns';

// Same names as server/src/db/index.js. The server and Scout share one database, so a different name
// for the same key fails with IndexOptionsConflict (owner report 2026-11-25).
export const RUN_INDEXES = [
  { key: { runId: 1 }, options: { unique: true, name: 'runId_unique' } },
  { key: { createdAt: -1 }, options: { name: 'recent' } },
];

export async function ensureScoutIndexes(db) {
  for (const { key, options } of RUN_INDEXES) await db.collection(RUNS).createIndex(key, options);
}

export const LIMITS = Object.freeze({
  maxPerCallAtomic: 100_000n, // $0.10 per call, never more
  defaultDailyAtomic: 300_000n, // $0.30 a day unless SCOUT_DAILY_MAX_USDC says otherwise
});

/** Picks the Base USDC option only, refusing anything over the per-call max or what's left of today's budget. */
export function pickPayment(options, { leftTodayAtomic }) {
  const opt = options.find((o) => o.network === BASE && String(o.asset).toLowerCase() === USDC.toLowerCase() && o.scheme === 'exact');
  if (!opt) throw new Error('no Base USDC exact payment option');
  if (String(opt.payTo).toLowerCase() !== PAY_TO.toLowerCase()) throw new Error('unexpected payee');
  const amount = BigInt(opt.amount);
  if (amount <= 0n || amount > LIMITS.maxPerCallAtomic) throw new Error(`price ${amount} is over the per-call max`);
  if (amount > leftTodayAtomic) throw new Error('over the daily budget');
  return opt;
}

/** Short human summary of a market-pulse response. Only fields we read; never invented. */
export function summarize(data) {
  if (!data || typeof data !== 'object') return 'unreadable response';
  const parts = [];
  const status = data.market_status?.market;
  if (status) parts.push(`US market ${status}`);
  const g = Array.isArray(data.gainers) ? data.gainers[0] : null;
  if (g?.ticker) parts.push(`top gainer ${g.ticker} ${Number(g.change_percent).toFixed(1)}%`);
  const l = Array.isArray(data.losers) ? data.losers[0] : null;
  if (l?.ticker) parts.push(`top loser ${l.ticker} ${Number(l.change_percent).toFixed(1)}%`);
  const n = Array.isArray(data.news) ? data.news[0] : null;
  if (n?.title) parts.push(`news: ${String(n.title).slice(0, 140)}`);
  return parts.length ? parts.join(' · ') : 'no known fields in response';
}

const startOfUtcDay = (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/** USDC (atomic) Scout paid or reserved today. Pending runs count too (fail closed). */
export async function spentToday(db, now = new Date()) {
  const runs = await db.collection(RUNS).find({ createdAt: { $gte: startOfUtcDay(now) }, status: { $in: ['paid', 'paid_no_data', 'pending', 'unknown'] } }).toArray();
  return runs.reduce((s, r) => s + BigInt(r.costUsdc ?? '0'), 0n);
}

/**
 * One Scout run.
 * deps: { db, fetchImpl, makePaidFetch(selector) → fetch, decodePaymentResponse(header), payer, mode, dailyMaxAtomic, now }
 * mode 'dry' reads the price only; 'live' pays.
 */
export async function runOnce({ db, fetchImpl = fetch, makePaidFetch, decodePaymentResponse, payer, mode = 'dry', dailyMaxAtomic = LIMITS.defaultDailyAtomic, now = new Date() }) {
  const runId = randomUUID();
  const spent = await spentToday(db, now);
  const leftTodayAtomic = dailyMaxAtomic > spent ? dailyMaxAtomic - spent : 0n;

  // Budget used up: a normal outcome, not an error (the hourly job runs on after the day's budget is spent).
  if (leftTodayAtomic === 0n) return { runId, mode, status: 'budget_reached', leftTodayAtomic: '0' };

  // Read the price first (unpaid request returns 402 + requirements).
  const probe = await fetchImpl(URL_TO_CALL);
  const header = probe.headers.get('payment-required');
  if (probe.status !== 402 || !header) throw new Error(`expected 402 from x402stock, got ${probe.status}`);
  const reqs = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  let opt;
  try {
    opt = pickPayment(reqs.accepts ?? [], { leftTodayAtomic });
  } catch (e) {
    if (e.message === 'over the daily budget') return { runId, mode, status: 'budget_reached', leftTodayAtomic: leftTodayAtomic.toString() };
    throw e;
  }

  if (mode !== 'live') {
    return { runId, mode, status: 'dry_run', wouldPayAtomic: opt.amount, payTo: opt.payTo, leftTodayAtomic: leftTodayAtomic.toString() };
  }

  // Reserve the cost first so two runs at once can't both pass the daily budget.
  const doc = { runId, status: 'pending', costUsdc: String(opt.amount), payer, payTo: opt.payTo, url: URL_TO_CALL, createdAt: now };
  await db.collection(RUNS).insertOne(doc);
  try {
    const paid = makePaidFetch((_v, options) => pickPayment(options, { leftTodayAtomic: leftTodayAtomic }));
    const res = await paid(URL_TO_CALL);
    const settle = res.headers.get('payment-response');
    const receipt = settle ? decodePaymentResponse(settle) : null;
    const txHash = receipt?.success && /^0x[0-9a-fA-F]{64}$/.test(receipt.transaction ?? '') ? receipt.transaction : null;
    let summary = null;
    if (res.ok) {
      try {
        summary = summarize(await res.json());
      } catch {
        summary = 'unreadable response';
      }
    }
    // paid: settled + data. paid_no_data: settled, no data. failed: refused with 402 (no money moved).
    // unknown: anything else — keep the cost reserved (fail closed for the budget).
    const status = txHash ? (res.ok ? 'paid' : 'paid_no_data') : res.status === 402 ? 'failed' : 'unknown';
    const set = { status, x402TxHash: txHash, summary, httpStatus: res.status, finishedAt: new Date() };
    if (status === 'failed') set.costUsdc = '0';
    await db.collection(RUNS).updateOne({ runId }, { $set: set });
    return { runId, mode, ...set, costUsdc: set.costUsdc ?? doc.costUsdc };
  } catch (e) {
    // Unknown outcome: keep it pending (counts against the budget) and report.
    await db.collection(RUNS).updateOne({ runId }, { $set: { error: String(e?.message ?? e).slice(0, 300) } });
    throw e;
  }
}
