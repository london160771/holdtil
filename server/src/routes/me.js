// Account routes (PRD §14): onboard, me, stop, resume.
import { Router } from 'express';
import { HoldtilError } from '../errors.js';
import { requireUser } from '../auth/session.js';
import { DEFAULTS } from '../config/limits.js';
import { spentToday } from '../core/limits.js';
import { REFILLS } from '../db/refills.js';
import { STOCKS, CHAIN_ID } from '../config/addresses.js';
import { publicMarketStatus } from '../core/marketHours.js';

export function publicUser(u) {
  return {
    address: u.address,
    notUsConfirmedAt: u.notUsConfirmedAt ?? null,
    termsAcceptedAt: u.termsAcceptedAt ?? null,
    onboarded: Boolean(u.notUsConfirmedAt && u.termsAcceptedAt),
    stopped: Boolean(u.stoppedAt),
    stoppedAt: u.stoppedAt ?? null,
    dailyLimitUsdc: String(u.dailyLimitUsdc ?? DEFAULTS.userDailyLimitUsdc),
    createdAt: u.createdAt,
  };
}

export function meRoutes({ db, config }) {
  const r = Router();
  r.use(requireUser(db));

  r.get('/', async (req, res) => {
    const agents = await db.collection('agents').find({ userId: String(req.user._id) }).project({ _id: 1 }).toArray();
    const since = new Date(Date.now() - 36 * 3600 * 1000);
    const refills = await db.collection(REFILLS).find({ agentId: { $in: agents.map((a) => String(a._id)) }, createdAt: { $gte: since } }).toArray();
    const spent = spentToday(refills, BigInt(Math.floor(Date.now() / 1000)));
    res.json({
      user: publicUser(req.user),
      totals: { agents: agents.length, spentTodayUsdc: spent.toString() },
      // Display only (PRD §16 "Market hours"): explains price_stale waits. The price guard still decides.
      market: publicMarketStatus(new Date()),
      // Public values the app needs to request a permission. Not secrets.
      chain: { chainId: CHAIN_ID, spenderAddress: config?.spenderAddress || null, stocks: Object.values(STOCKS).map((s) => ({ symbol: s.symbol, name: s.name, address: s.address, decimals: s.decimals })) },
    });
  });

  // FR-AUTH-002
  r.post('/onboard', async (req, res) => {
    const { notUs, terms } = req.body ?? {};
    if (notUs !== true || terms !== true) {
      throw new HoldtilError('invalid_input', 'You must confirm you are not a US person and accept the terms', { status: 400 });
    }
    const now = new Date();
    const user = await db.collection('users').findOneAndUpdate(
      { _id: req.user._id },
      { $set: { notUsConfirmedAt: req.user.notUsConfirmedAt ?? now, termsAcceptedAt: req.user.termsAcceptedAt ?? now, dailyLimitUsdc: req.user.dailyLimitUsdc ?? DEFAULTS.userDailyLimitUsdc.toString() } },
      { returnDocument: 'after' },
    );
    res.json({ user: publicUser(user) });
  });

  // FR-CTL-001: Stop all agents. Blocks the next tick (INV-7).
  r.post('/stop', async (req, res) => {
    const user = await db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: { stoppedAt: new Date() } }, { returnDocument: 'after' });
    res.json({ user: publicUser(user) });
  });

  r.post('/resume', async (req, res) => {
    const user = await db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: { stoppedAt: null } }, { returnDocument: 'after' });
    res.json({ user: publicUser(user) });
  });

  return r;
}
