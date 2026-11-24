// INV-4: one refill per agent at a time, enforced by a unique index (in-memory MongoDB; never a real DB).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { ensureRefillIndexes, createPlannedRefill, moveRefill, makeRefillId, REFILLS } from '../../src/db/refills.js';

let mongod;
let client;
let db;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  client = await MongoClient.connect(mongod.getUri());
  db = client.db('holdtil_test');
}, 120_000);

afterAll(async () => {
  await client?.close();
  await mongod?.stop();
});

beforeEach(async () => {
  await db.collection(REFILLS).deleteMany({});
  await ensureRefillIndexes(db);
});

describe('refills single flight (INV-4, FR-RFL-004)', () => {
  it('two ticks at the same moment → exactly one refill, the other gets refill_in_flight', async () => {
    const results = await Promise.allSettled([
      createPlannedRefill(db, { agentId: 'a1', tickId: 'tick-1', plannedUsdc: 1_000_000n }),
      createPlannedRefill(db, { agentId: 'a1', tickId: 'tick-2', plannedUsdc: 1_000_000n }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect(bad[0].reason.code).toBe('refill_in_flight');
    expect(await db.collection(REFILLS).countDocuments({ agentId: 'a1' })).toBe(1);
  });

  it('20 parallel ticks → still one', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => createPlannedRefill(db, { agentId: 'a2', tickId: `t${i}`, plannedUsdc: 1n })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('same tick run twice is idempotent (same refillId rejected)', async () => {
    const r1 = await createPlannedRefill(db, { agentId: 'a3', tickId: 'same', plannedUsdc: 1n });
    await moveRefill(db, r1, 'waited', { code: 'price_stale' });
    await expect(createPlannedRefill(db, { agentId: 'a3', tickId: 'same', plannedUsdc: 1n })).rejects.toMatchObject({ code: 'refill_in_flight' });
    expect(makeRefillId('a3', 'same')).toBe(r1.refillId);
  });

  it('a finished refill frees the agent for the next tick', async () => {
    let r = await createPlannedRefill(db, { agentId: 'a4', tickId: 't1', plannedUsdc: 1n });
    r = await moveRefill(db, r, 'checked');
    r = await moveRefill(db, r, 'simulated');
    // still in flight while simulated/sent
    await expect(createPlannedRefill(db, { agentId: 'a4', tickId: 't2', plannedUsdc: 1n })).rejects.toMatchObject({ code: 'refill_in_flight' });
    r = await moveRefill(db, r, 'sent', { fields: { txHash: '0xabc' } });
    await expect(createPlannedRefill(db, { agentId: 'a4', tickId: 't3', plannedUsdc: 1n })).rejects.toMatchObject({ code: 'refill_in_flight' });
    r = await moveRefill(db, r, 'confirmed');
    const next = await createPlannedRefill(db, { agentId: 'a4', tickId: 't4', plannedUsdc: 1n });
    expect(next.state).toBe('planned');
    const saved = await db.collection(REFILLS).findOne({ refillId: r.refillId });
    expect(saved.state).toBe('confirmed');
    expect(saved.inFlight).toBeUndefined();
    expect(saved.txHash).toBe('0xabc');
    expect(saved.history.map((h) => h.to)).toEqual(['planned', 'checked', 'simulated', 'sent', 'confirmed']);
  });

  it('different agents refill in parallel', async () => {
    const results = await Promise.allSettled([
      createPlannedRefill(db, { agentId: 'b1', tickId: 't', plannedUsdc: 1n }),
      createPlannedRefill(db, { agentId: 'b2', tickId: 't', plannedUsdc: 1n }),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('two workers cannot both move the same refill', async () => {
    const r = await createPlannedRefill(db, { agentId: 'c1', tickId: 't', plannedUsdc: 1n });
    const results = await Promise.allSettled([moveRefill(db, r, 'checked'), moveRefill(db, r, 'waited', { code: 'price_stale' })]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((x) => x.status === 'rejected').reason.code).toBe('illegal_transition');
  });

  it('plannedUsdc is stored as a string (INV-1)', async () => {
    await createPlannedRefill(db, { agentId: 'd1', tickId: 't', plannedUsdc: 123_456_789_012_345_678n });
    const saved = await db.collection(REFILLS).findOne({ agentId: 'd1' });
    expect(saved.plannedUsdc).toBe('123456789012345678');
  });
});
