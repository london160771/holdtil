// Agents (PRD FR-AGT-001, §14). The wallet address is the refill destination (INV-5): it is set once
// at creation and can never be changed. To use another wallet, add a new agent.
import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getAddress, isAddress, zeroAddress } from 'viem';
import { HoldtilError } from '../errors.js';
import { requireUser, requireOnboarded } from '../auth/session.js';
import { DEFAULTS, HARD_CAPS } from '../config/limits.js';
import { isAllowlisted } from '../config/addresses.js';
import { parseUnitsString } from '../services/money.js';

const bad = (msg) => new HoldtilError('invalid_input', msg, { status: 400 });
const MONEY = ['floorUsdc', 'targetUsdc', 'maxPerRefillUsdc', 'dailyLimitUsdc'];

function cleanName(name) {
  if (typeof name !== 'string') throw bad('name is required');
  const n = name.trim();
  if (n.length < 1 || n.length > 40) throw bad('name must be 1–40 characters');
  return n;
}

function cleanLimits(input, base) {
  const caps = { floorUsdc: HARD_CAPS.targetUsdc, targetUsdc: HARD_CAPS.targetUsdc, maxPerRefillUsdc: HARD_CAPS.maxPerRefillUsdc, dailyLimitUsdc: HARD_CAPS.dailyLimitUsdc };
  const out = { ...base };
  for (const k of MONEY) {
    if (input[k] !== undefined) out[k] = parseUnitsString(input[k], k, { max: caps[k] });
  }
  if (out.floorUsdc >= out.targetUsdc) throw bad('floor must be below target');
  if (out.maxPerRefillUsdc <= 0n) throw bad('max per refill must be above 0');
  if (out.dailyLimitUsdc < out.maxPerRefillUsdc) throw bad('daily limit must be at least the max per refill');
  return out;
}

export function publicAgent(a, balance) {
  return {
    id: String(a._id),
    name: a.name,
    walletAddress: a.walletAddress,
    floorUsdc: a.floorUsdc,
    targetUsdc: a.targetUsdc,
    maxPerRefillUsdc: a.maxPerRefillUsdc,
    dailyLimitUsdc: a.dailyLimitUsdc,
    status: a.status,
    createdAt: a.createdAt,
    ...(balance !== undefined ? { usdcBalance: balance } : {}),
  };
}

async function ownAgent(db, req) {
  if (!ObjectId.isValid(req.params.id)) throw new HoldtilError('not_found', 'Agent not found', { status: 404 });
  const a = await db.collection('agents').findOne({ _id: new ObjectId(req.params.id), userId: String(req.user._id) });
  if (!a) throw new HoldtilError('not_found', 'Agent not found', { status: 404 }); // same answer for "not yours"
  return a;
}

export function agentRoutes({ db, chain }) {
  const r = Router();
  r.use(requireUser(db));

  // Live USDC balance from chain; "unavailable" on any read error (CLAUDE.md §8).
  const balanceOf = async (addr) => {
    try {
      return (await chain.readUsdcBalance(addr)).toString();
    } catch {
      return 'unavailable';
    }
  };

  r.get('/', async (req, res) => {
    const list = await db.collection('agents').find({ userId: String(req.user._id) }).sort({ createdAt: 1 }).toArray();
    const balances = await Promise.all(list.map((a) => balanceOf(a.walletAddress)));
    res.json({ agents: list.map((a, i) => publicAgent(a, balances[i])) });
  });

  r.get('/:id', async (req, res) => {
    const a = await ownAgent(db, req);
    res.json({ agent: publicAgent(a, await balanceOf(a.walletAddress)) });
  });

  r.post('/', requireOnboarded, async (req, res) => {
    const body = req.body ?? {};
    const name = cleanName(body.name);
    if (typeof body.walletAddress !== 'string' || !isAddress(body.walletAddress, { strict: false })) throw bad('wallet address is not a valid address');
    const wallet = getAddress(body.walletAddress);
    if (wallet === zeroAddress) throw bad('wallet address cannot be the zero address');
    if (isAllowlisted(wallet)) throw bad('wallet address cannot be a token, feed, pool or protocol contract');
    if (wallet.toLowerCase() === req.user.address) throw bad('use a separate wallet for your agent, not your own account');
    const limits = cleanLimits(body, {
      floorUsdc: DEFAULTS.floorUsdc, targetUsdc: DEFAULTS.targetUsdc, maxPerRefillUsdc: DEFAULTS.maxPerRefillUsdc, dailyLimitUsdc: DEFAULTS.dailyLimitUsdc,
    });
    const doc = {
      userId: String(req.user._id),
      name,
      walletAddress: wallet,
      ...Object.fromEntries(MONEY.map((k) => [k, limits[k].toString()])),
      status: 'active',
      createdAt: new Date(),
    };
    try {
      const { insertedId } = await db.collection('agents').insertOne(doc);
      res.status(201).json({ agent: publicAgent({ ...doc, _id: insertedId }) });
    } catch (e) {
      if (e?.code === 11000) throw bad('you already added this agent wallet');
      throw e;
    }
  });

  r.patch('/:id', requireOnboarded, async (req, res) => {
    const a = await ownAgent(db, req);
    const body = req.body ?? {};
    if (body.walletAddress !== undefined) throw bad('the agent wallet cannot be changed; add a new agent instead');
    const allowed = new Set(['name', 'status', ...MONEY]);
    for (const k of Object.keys(body)) if (!allowed.has(k)) throw bad(`unknown field ${k}`);
    const set = {};
    if (body.name !== undefined) set.name = cleanName(body.name);
    if (body.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'paused') throw bad('status must be active or paused');
      set.status = body.status;
    }
    if (MONEY.some((k) => body[k] !== undefined)) {
      const limits = cleanLimits(body, Object.fromEntries(MONEY.map((k) => [k, BigInt(a[k])])));
      for (const k of MONEY) set[k] = limits[k].toString();
    }
    const updated = await db.collection('agents').findOneAndUpdate({ _id: a._id, userId: a.userId }, { $set: { ...set, updatedAt: new Date() } }, { returnDocument: 'after' });
    res.json({ agent: publicAgent(updated) });
  });

  return r;
}
