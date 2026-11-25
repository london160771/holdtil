// Refill records (PRD §14) with INV-4 enforced by the database, not by reading first.
// A partial unique index on agentId over documents with `inFlight: true` means at most one
// in-flight refill per agent. The insert either wins or gets a duplicate-key error.
import { createHash } from 'node:crypto';
import { HoldtilError } from '../errors.js';
import { IN_FLIGHT_STATES, transition } from '../core/stateMachine.js';

export const REFILLS = 'refills';

export async function ensureRefillIndexes(db) {
  const c = db.collection(REFILLS);
  await c.createIndex({ refillId: 1 }, { unique: true, name: 'refillId_unique' });
  await c.createIndex(
    { agentId: 1 },
    { unique: true, partialFilterExpression: { inFlight: true }, name: 'one_in_flight_per_agent' },
  );
  await c.createIndex({ agentId: 1, createdAt: -1 }, { name: 'agent_recent' });
}

/** Idempotent refill id: same agent + same tick → same id, so a re-run tick can't create a second refill. */
export function makeRefillId(agentId, tickId) {
  return createHash('sha256').update(`${agentId}:${tickId}`).digest('hex').slice(0, 32);
}

const toDoc = (r) => ({
  ...r,
  plannedUsdc: r.plannedUsdc?.toString(),
  inFlight: IN_FLIGHT_STATES.includes(r.state) ? true : undefined,
});

/**
 * Inserts a `planned` refill. Throws refill_in_flight if this agent already has one in flight
 * or this refillId already exists (same tick run twice).
 */
export async function createPlannedRefill(db, { agentId, tickId, plannedUsdc, now = new Date() }) {
  const refill = {
    refillId: makeRefillId(agentId, tickId),
    agentId,
    tickId,
    state: 'planned',
    code: null,
    plannedUsdc,
    createdAt: now,
    history: [{ from: null, to: 'planned', at: now.toISOString(), code: null, note: null }],
  };
  const doc = toDoc(refill);
  if (doc.inFlight === undefined) delete doc.inFlight;
  try {
    await db.collection(REFILLS).insertOne(doc);
  } catch (e) {
    if (e?.code === 11000) {
      const sameWindow = Boolean(e?.keyPattern?.refillId);
      throw new HoldtilError(
        'refill_in_flight',
        sameWindow ? 'this agent was already handled in this 5-minute window (same mode); try after the window' : 'another refill for this agent is in flight',
        { status: 409 },
      );
    }
    throw e;
  }
  return refill;
}

/**
 * Moves a refill to `to`. Uses the current state as a guard in the update filter, so two workers
 * can't both move the same refill. Clears `inFlight` on terminal states.
 */
// Extra fields a transition may record. Money is stored as strings (INV-1).
const MOVABLE_FIELDS = new Set([
  'stockAmount', 'usdcOut', 'minOut', 'refPrice', 'refPriceAt', 'quotePrice', 'gapBps', 'txHash', 'reason',
  'userOpHash', 'permissionHash', 'quotedOut', 'simulatedUsdcOut', 'maxPayoutUsdc', 'mode', 'sentAt', 'confirmedAt',
]);

function cleanFields(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!MOVABLE_FIELDS.has(k)) throw new HoldtilError('invalid_input', `field ${k} cannot be set by a transition`);
    out[k] = typeof v === 'bigint' ? v.toString() : v;
  }
  return out;
}

/**
 * Records the user operation hash on a `sent` refill right after the send call returns (before waiting).
 * Guarded by state so it can't touch anything else.
 */
export async function recordSendHash(db, refillId, userOpHash) {
  if (typeof userOpHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(userOpHash)) throw new HoldtilError('invalid_input', 'bad user operation hash');
  const res = await db.collection(REFILLS).updateOne({ refillId, state: 'sent', userOpHash: { $exists: false } }, { $set: { userOpHash } });
  if (res.matchedCount !== 1) throw new HoldtilError('illegal_transition', `refill ${refillId} is not a sent refill without a hash`, { status: 409 });
}

export async function moveRefill(db, refill, to, opts = {}) {
  const fields = cleanFields(opts.fields);
  const next = transition(refill, to, opts);
  const set = { state: next.state, code: next.code, history: next.history, ...fields };
  const update = IN_FLIGHT_STATES.includes(to) ? { $set: set } : { $set: set, $unset: { inFlight: '' } };
  const res = await db.collection(REFILLS).updateOne({ refillId: refill.refillId, state: refill.state }, update);
  if (res.matchedCount !== 1) {
    throw new HoldtilError('illegal_transition', `refill ${refill.refillId} is no longer in state ${refill.state}`, { status: 409 });
  }
  return { ...next, ...fields };
}

/**
 * Crash recovery (review finding, PRD §16): refills stuck in planned/checked/simulated longer than
 * `maxAgeMs` never reached the chain, so they move to `waited` with `refill_expired` and free the agent.
 * Stuck `sent` refills are NOT touched here: they may be on chain. They are returned so the caller
 * (Phase 3 tick) can look up the tx hash on chain before deciding.
 */
export async function recoverStaleRefills(db, { now = new Date(), maxAgeMs = 15 * 60_000 } = {}) {
  const cutoff = new Date(now.getTime() - maxAgeMs);
  const stale = await db.collection(REFILLS).find({ inFlight: true, createdAt: { $lt: cutoff } }).toArray();
  const expired = [];
  const stuckSent = [];
  for (const doc of stale) {
    if (doc.state === 'sent') {
      stuckSent.push(doc);
      continue;
    }
    try {
      expired.push(await moveRefill(db, doc, 'waited', { code: 'refill_expired', at: now.toISOString() }));
    } catch (e) {
      if (e?.code !== 'illegal_transition') throw e; // someone else moved it first; fine
    }
  }
  return { expired, stuckSent };
}
