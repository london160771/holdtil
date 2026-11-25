import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { pickPayment, summarize, runOnce, spentToday, USDC, BASE, RUNS } from '../src/scout.js';

const opt = (o = {}) => ({ scheme: 'exact', network: BASE, asset: USDC, amount: '30000', payTo: '0x3070Fbb3803819fB5BdfE9286fdc6325A877fA85', ...o });
const reqHeader = (accepts = [opt()]) => Buffer.from(JSON.stringify({ x402Version: 2, accepts })).toString('base64');
const TX = `0x${'a'.repeat(64)}`;
const SAMPLE = { market_status: { market: 'open' }, gainers: [{ ticker: 'QH', change_percent: 12.345, price: 7.7 }], losers: [{ ticker: 'DAIC', change_percent: -9.1, price: 0.14 }], news: [{ title: 'Stocks rise' }] };

function fakeFetch({ status = 402, accepts } = {}) {
  return async () => ({ status, headers: new Map([['payment-required', reqHeader(accepts)]]) });
}
function paidFetch({ ok = true, status = 200, receipt = { success: true, transaction: TX }, body = SAMPLE } = {}) {
  return (selector) => async () => {
    selector(2, [opt()]);
    return { ok, status, headers: new Map(receipt ? [['payment-response', 'x']] : []), json: async () => body };
  };
}

let mongod;
let client;
let db;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  client = await MongoClient.connect(mongod.getUri());
  db = client.db('scout_test');
});
afterAll(async () => {
  await client?.close();
  await mongod?.stop();
});

describe('pickPayment', () => {
  it('takes Base USDC exact within limits', () => {
    expect(pickPayment([opt({ network: 'eip155:1' }), opt()], { leftTodayAtomic: 300_000n }).network).toBe(BASE);
  });
  it('refuses other assets, prices over $0.10, and over the daily budget', () => {
    expect(() => pickPayment([opt({ asset: '0x0000000000000000000000000000000000000001' })], { leftTodayAtomic: 1n << 60n })).toThrow();
    expect(() => pickPayment([opt({ amount: '100001' })], { leftTodayAtomic: 1n << 60n })).toThrow(/per-call/);
    expect(() => pickPayment([opt()], { leftTodayAtomic: 29_999n })).toThrow(/daily/);
  });
});

describe('summarize', () => {
  it('reads only known fields', () => {
    expect(summarize(SAMPLE)).toBe('US market open · top gainer QH 12.3% · top loser DAIC -9.1% · news: Stocks rise');
    expect(summarize({})).toBe('no known fields in response');
    expect(summarize(null)).toBe('unreadable response');
  });
});

describe('runOnce', () => {
  const deps = (o = {}) => ({ db, fetchImpl: fakeFetch(), makePaidFetch: paidFetch(), decodePaymentResponse: () => ({ success: true, transaction: TX }), payer: '0x1', ...o });

  it('dry mode reads the price and pays nothing', async () => {
    const r = await runOnce(deps({ makePaidFetch: () => { throw new Error('must not pay'); } }));
    expect(r).toMatchObject({ status: 'dry_run', wouldPayAtomic: '30000' });
    expect(await db.collection(RUNS).countDocuments()).toBe(0);
  });

  it('live mode pays, stores the tx hash and summary', async () => {
    const r = await runOnce(deps({ mode: 'live' }));
    expect(r).toMatchObject({ status: 'paid', x402TxHash: TX, costUsdc: '30000' });
    const doc = await db.collection(RUNS).findOne({ runId: r.runId });
    expect(doc).toMatchObject({ status: 'paid', x402TxHash: TX, summary: expect.stringContaining('top gainer QH') });
  });

  it('a 402 refusal costs nothing', async () => {
    const r = await runOnce(deps({ mode: 'live', makePaidFetch: paidFetch({ ok: false, status: 402, receipt: null }), decodePaymentResponse: () => null }));
    expect(r).toMatchObject({ status: 'failed', costUsdc: '0' });
  });

  it('unclear outcome keeps the cost reserved', async () => {
    const r = await runOnce(deps({ mode: 'live', makePaidFetch: paidFetch({ ok: false, status: 500, receipt: null }), decodePaymentResponse: () => null }));
    expect(r).toMatchObject({ status: 'unknown', costUsdc: '30000' });
  });

  it('stops at the daily budget', async () => {
    await db.collection(RUNS).deleteMany({});
    const now = new Date();
    for (let i = 0; i < 10; i++) await runOnce(deps({ mode: 'live', now }));
    expect(await spentToday(db, now)).toBe(300_000n);
    await expect(runOnce(deps({ mode: 'live', now }))).rejects.toThrow(/daily budget/);
  });
});
