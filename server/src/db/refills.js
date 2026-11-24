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
      throw new HoldtilError('refill_in_flight', 'another refill for this agent is active or this tick already ran', { status: 409 });
    }
    throw e;
  }
  return refill;
}

/**
 * Moves a refill to `to`. Uses the current state as a guard in the update filter, so two workers
 * can't both move the same refill. Clears `inFlight` on terminal states.
 */
export async function moveRefill(db, refill, to, opts = {}) {
  const next = transition(refill, to, opts);
  const set = { state: next.state, code: next.code, history: next.history, ...(opts.fields ?? {}) };
  const update = IN_FLIGHT_STATES.includes(to) ? { $set: set } : { $set: set, $unset: { inFlight: '' } };
  const res = await db.collection(REFILLS).updateOne({ refillId: refill.refillId, state: refill.state }, update);
  if (res.matchedCount !== 1) {
    throw new HoldtilError('illegal_transition', `refill ${refill.refillId} is no longer in state ${refill.state}`, { status: 409 });
  }
  return { ...next, ...(opts.fields ?? {}) };
}
