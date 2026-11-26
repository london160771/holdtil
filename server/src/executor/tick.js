// The refill executor (PRD §9, §11, §27 Phase 3). One tick looks at every active agent once.
// Order per agent: controls (INV-7) → need → permission → price (INV-2) → limits (INV-3) → lock (INV-4)
// → simulate → [dry run stops here] → controls again → send (hash saved) → confirm.
// Fails closed: anything unknown is a wait or a block, never a sale. Safe to run late or twice.
import { getAddress } from 'viem';
import { STOCKS, stockOf } from '../config/addresses.js';
import { EXECUTOR } from '../config/executor.js';
import { HoldtilError } from '../errors.js';
import { checkControls } from '../core/decide.js';
import { checkPrice, quotePriceFromSwap } from '../core/priceGuard.js';
import { checkLimits, spentToday } from '../core/limits.js';
import { planRefillUsdc, stockAmountForUsdc, usdcValue, minOut as computeMinOut, maxPayoutUsdc } from '../core/refillPlanner.js';
import { decisionStateFor } from '../core/stateMachine.js';
import { getSettings } from '../db/index.js';
import { REFILLS, createPlannedRefill, moveRefill, recordSendHash, recoverStaleRefills } from '../db/refills.js';
import { fromDb } from '../routes/permissions.js';

const USDC_DECIMALS = 6;
const toBig = (v) => BigInt(v);

/** Bucket id for idempotent refill ids: the same agent in the same 5-minute window gets the same id. */
export const tickIdFor = (now) => `t${Math.floor(now.getTime() / 300_000)}`;

function stop(code, reason, extra = {}) {
  return { ok: false, code, reason, ...extra };
}

/** Upper bound of USDC a refill planned at `usdc` can pay out, so in-flight counting stays conservative. */
/**
 * Safe text for stored notes and API answers (Checkpoint C #3). viem messages can include the RPC URL,
 * and a provider URL can carry its API key in the path. Use the short message and strip any URL.
 */
export function safeMessage(e, fallback = 'error') {
  const raw = typeof e === 'string' ? e : (e?.shortMessage ?? e?.message ?? fallback);
  return String(raw).split('\n')[0].replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[url]').slice(0, 200);
}

const upperBound = (usdc) => (usdc * (10_000n + EXECUTOR.bufferBps + EXECUTOR.maxGapBps + 10n) + 9_999n) / 10_000n;

async function loadUser(db, agent) {
  const { ObjectId } = await import('mongodb');
  return ObjectId.isValid(agent.userId) ? db.collection('users').findOne({ _id: new ObjectId(agent.userId) }) : null;
}

/** Re-reads every control from the DB and chain. Used at the start and again right before sending (INV-7). */
async function readControls(db, chain, agent, permission, nowSec) {
  const [settings, user, fresh] = await Promise.all([getSettings(db), loadUser(db, agent), db.collection('agents').findOne({ _id: agent._id })]);
  let permissionStatus = 'unknown';
  let status = null;
  if (permission) {
    try {
      status = await chain.readPermissionStatus(permission, nowSec);
      permissionStatus = status.status;
    } catch {
      permissionStatus = 'unknown';
    }
  }
  const c = checkControls({
    globalPause: settings.globalPause,
    userStopped: user ? Boolean(user.stoppedAt) : true,
    agentPaused: fresh ? fresh.status !== 'active' : true,
    permissionStatus,
  });
  return { ...c, status, user };
}

/** Newest signed permission for this user and stock (validity is checked on chain). */
async function findPermission(db, userId, stock) {
  const d = await db
    .collection('permissions')
    .find({ userId, token: getAddress(stock.address), status: 'signed' })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  return d ? { doc: d, permission: fromDb(d.permission) } : null;
}

async function todaySpend(db, { agentId, userId, excludeRefillId, nowSec }) {
  const since = new Date(Date.now() - 36 * 3600 * 1000);
  const agents = await db.collection('agents').find({ userId }).project({ _id: 1 }).toArray();
  const ids = agents.map((a) => String(a._id));
  const all = await db.collection(REFILLS).find({ agentId: { $in: ids }, createdAt: { $gte: since }, refillId: { $ne: excludeRefillId } }).toArray();
  return { agent: spentToday(all.filter((r) => r.agentId === agentId), nowSec), user: spentToday(all, nowSec) };
}

/**
 * Read-only checks (nothing written). Returns the full sale plan or the first reason to stop.
 */
async function evaluate({ db, chain, agent, user, stock, nowSec, excludeRefillId, liveCap }) {
  const agentId = String(agent._id);
  const balance = await chain.readUsdcBalance(agent.walletAddress);
  // Plan small enough that even the worst fair payout stays under the per-refill max (INV-3).
  const maxPer = liveCap !== undefined && liveCap < toBig(agent.maxPerRefillUsdc) ? liveCap : toBig(agent.maxPerRefillUsdc);
  const capForPlan = (maxPer * 10_000n) / (10_000n + EXECUTOR.bufferBps + EXECUTOR.maxGapBps + 10n);
  const need = planRefillUsdc({
    balanceUsdc: balance,
    floorUsdc: toBig(agent.floorUsdc),
    targetUsdc: toBig(agent.targetUsdc),
    maxPerRefillUsdc: capForPlan,
  });
  if (!need.needed) return { ok: true, needed: false, balance };

  const found = await findPermission(db, String(user._id), stock);
  if (!found) return stop('permission_revoked', 'no signed permission for this stock', { balance });
  const { permission, doc: permDoc } = found;
  let pStatus;
  try {
    pStatus = await chain.readPermissionStatus(permission, nowSec);
  } catch {
    return stop('permission_revoked', 'permission status unavailable', { balance });
  }
  if (pStatus.status !== 'active') return stop('permission_revoked', `permission ${pStatus.status}`, { balance });

  const ref = await chain.readReference(stock);
  // Fit the refill to what the permission still allows today, instead of blocking (smaller refill, same rules).
  let plannedUsdc = need.usdc;
  if (ref.answer > 0n) {
    const fits = (usdcValue({ stockAmount: pStatus.remaining, price: ref.answer, tokenDecimals: stock.decimals, usdcDecimals: USDC_DECIMALS, priceDecimals: ref.decimals }) * 10_000n) / (10_000n + EXECUTOR.bufferBps + 1n);
    if (fits < plannedUsdc) plannedUsdc = fits;
    if (plannedUsdc < EXECUTOR.minRefillUsdc) return stop('allowance_exhausted', 'permission allowance left today is too small for a refill', { balance });
  }
  const stockAmount = stockAmountForUsdc({
    usdc: plannedUsdc,
    refPrice: ref.answer > 0n ? ref.answer : 1n,
    tokenDecimals: stock.decimals,
    usdcDecimals: USDC_DECIMALS,
    priceDecimals: ref.decimals,
    bufferBps: EXECUTOR.bufferBps,
  });
  // No quote → 0 → checkPrice turns it into a wait.
  const quotedOut = await chain.quoteSell(stock, stockAmount).then((q) => q.amountOut, () => 0n);
  const quotePrice = quotedOut > 0n
    ? quotePriceFromSwap({ amountIn: stockAmount, amountOut: quotedOut, tokenDecimals: stock.decimals, usdcDecimals: USDC_DECIMALS, priceDecimals: ref.decimals })
    : 0n;
  const price = checkPrice({
    refPrice: ref.answer,
    refUpdatedAt: ref.updatedAt,
    now: nowSec,
    quotePrice,
    maxPriceAgeSec: EXECUTOR.maxPriceAgeSec,
    maxGapBps: EXECUTOR.maxGapBps,
    maxFutureSkewSec: EXECUTOR.maxFutureSkewSec,
    refDecimals: ref.decimals,
    quoteDecimals: ref.decimals,
    roundId: ref.roundId,
    answeredInRound: ref.answeredInRound,
  });
  const facts = {
    balance,
    plannedUsdc,
    stockAmount,
    quotedOut,
    refPrice: ref.answer,
    refPriceAt: ref.updatedAt,
    quotePrice,
    gapBps: price.gapBps ?? null,
  };
  if (!price.ok) return stop(price.code, price.reason, facts);

  const common = { stockAmount, quotedOut, refPrice: ref.answer, tokenDecimals: stock.decimals, usdcDecimals: USDC_DECIMALS, priceDecimals: ref.decimals, maxGapBps: EXECUTOR.maxGapBps };
  const minOut = computeMinOut({ ...common, slippageBps: EXECUTOR.slippageBps });
  const payout = maxPayoutUsdc(common);
  const spent = await todaySpend(db, { agentId, userId: String(user._id), excludeRefillId, nowSec });
  const limits = checkLimits({
    refillUsdc: payout,
    maxPerRefillUsdc: maxPer,
    agentSpentTodayUsdc: spent.agent,
    agentDailyLimitUsdc: toBig(agent.dailyLimitUsdc),
    userSpentTodayUsdc: spent.user,
    userDailyLimitUsdc: toBig(user.dailyLimitUsdc ?? '0'),
    stockAmount,
    allowanceRemaining: pStatus.remaining,
  });
  if (!limits.ok) return stop(limits.code, limits.reason, { ...facts, minOut, maxPayoutUsdc: payout });
  return { ok: true, needed: true, ...facts, minOut, maxPayoutUsdc: payout, permission, permDoc };
}

/** Writes a waited/blocked decision unless the same reason was logged for this agent in the last hour. */
async function recordDecision(db, { agentId, tickId, now, code, reason, facts }) {
  const last = await db.collection(REFILLS).find({ agentId }).sort({ createdAt: -1 }).limit(1).next();
  if (last && last.code === code && now.getTime() - new Date(last.createdAt).getTime() < EXECUTOR.repeatDecisionMs) {
    return { logged: false };
  }
  let r;
  try {
    r = await createPlannedRefill(db, { agentId, tickId, plannedUsdc: facts.plannedUsdc ? upperBound(facts.plannedUsdc) : 0n, now });
  } catch (e) {
    if (e?.code === 'refill_in_flight') return { logged: false };
    throw e;
  }
  await moveRefill(db, r, decisionStateFor(code), { code, note: reason, at: now.toISOString(), fields: pick(facts) });
  return { logged: true, refillId: r.refillId };
}

const FACT_KEYS = ['stock', 'stockAmount', 'quotedOut', 'minOut', 'refPrice', 'refPriceAt', 'quotePrice', 'gapBps', 'maxPayoutUsdc'];
function pick(facts) {
  const out = {};
  for (const k of FACT_KEYS) if (facts?.[k] !== undefined && facts[k] !== null) out[k] = facts[k];
  return out;
}

/** Settles a `sent` refill from chain. Pending stays sent. No hash = leave it locked and report (fail closed). */
async function settleSent(db, chain, refill, timeoutSec = 5) {
  if (!refill.userOpHash) return { refillId: refill.refillId, state: 'sent', alert: true, note: 'no hash recorded; check the spender on chain by hand' };
  const agent = await db.collection('agents').findOne({ _id: await toObjectId(refill.agentId) });
  if (!agent?.walletAddress) return { refillId: refill.refillId, state: 'sent', alert: true, note: 'agent record missing; check by hand' };
  // Refills from before multi-stock have no `stock`: they were all NVDAc.
  const stock = STOCKS[refill.stock ?? 'NVDAc'];
  if (!stock) return { refillId: refill.refillId, state: 'sent', alert: true, note: 'unknown stock on refill; check by hand' };
  const res = await chain.checkRefill({ userOpHash: refill.userOpHash, agentWallet: agent.walletAddress, pool: stock.pool.address, timeoutSec });
  // Review fix (Checkpoint B #4): our user op succeeded but we can't see the USDC → stay locked and alert.
  // Never free the agent or count $0 when stock may have been sold.
  if (res.status === 'complete' && (typeof res.usdcOut !== 'bigint' || res.usdcOut <= 0n)) {
    return { refillId: refill.refillId, state: 'sent', alert: true, txHash: res.txHash, note: 'included on chain but no USDC seen at the agent wallet; check by hand' };
  }
  if (res.status === 'complete') {
    await moveRefill(db, refill, 'confirmed', { fields: { txHash: res.txHash, usdcOut: res.usdcOut, confirmedAt: new Date().toISOString() } });
    return { refillId: refill.refillId, state: 'confirmed', txHash: res.txHash };
  }
  if (res.status === 'failed') {
    await moveRefill(db, refill, 'failed', { code: 'tx_failed', note: res.error ?? 'user operation failed', fields: res.txHash ? { txHash: res.txHash } : {} });
    return { refillId: refill.refillId, state: 'failed' };
  }
  if (res.status === 'unknown') return { refillId: refill.refillId, state: 'sent', alert: true, txHash: res.txHash, note: 'our user op was not found in the receipt; check by hand' };
  return { refillId: refill.refillId, state: 'sent', note: 'still pending' };
}

async function toObjectId(id) {
  const { ObjectId } = await import('mongodb');
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

/** Full path for one agent. Returns a summary line. */
/** Live only for owner-listed accounts (rollout step 4); everyone else runs as a dry run. */
export function agentMode(mode, user, config) {
  if (mode !== 'live') return 'dry';
  const allowed = (config.liveUsers ?? []).map((a) => a.toLowerCase());
  return user?.address && allowed.includes(user.address.toLowerCase()) ? 'live' : 'dry';
}

export async function processAgent({ db, chain, config, agent: agentIn, tickId, now, mode: tickMode, stock = stockOf(agentIn) }) {
  let agent = agentIn;
  const agentId = String(agent._id);
  let user = await loadUser(db, agent);
  const mode = agentMode(tickMode, user, config);
  // Rollout cap (default $1) applies to dry runs too, so a dry run shows exactly what live would do.
  const liveCap = config.liveMaxRefillUsdc ?? 1_000_000n;
  let nowSec = await chain.blockTime(); // fresh per agent (Checkpoint B #2)
  // Idempotency window per mode: a dry-run record never takes the id a live run needs (owner report 2026-11-25).
  const runId = `${tickId}:${mode}`;
  if (!user) return { agentId, result: 'skipped', code: 'paused', reason: 'owner not found' };
  if (user.stoppedAt) return { agentId, result: 'skipped', code: 'paused', reason: 'owner pressed Stop' };
  if (agent.status !== 'active') return { agentId, result: 'skipped', code: 'paused', reason: 'agent paused' };
  // Checkpoint C #6: each failed transaction costs the spender gas. After a few in a day, stop trying
  // for this agent until the day passes, so a broken wallet or batch can't drain the gas wallet.
  const failedRecently = await db.collection(REFILLS).countDocuments({ agentId, state: 'failed', code: 'tx_failed', createdAt: { $gte: new Date(now.getTime() - 24 * 3600 * 1000) } });
  if (failedRecently >= EXECUTOR.maxFailedTxPerDay) {
    const reason = `${failedRecently} failed transactions in 24 hours; waiting before trying again`;
    const d = await recordDecision(db, { agentId, tickId: runId, now, code: 'paused', reason, facts: {} });
    return { agentId, result: 'skipped', code: 'paused', reason, alert: Boolean(d.logged), ...d };
  }

  if (!stock) return { agentId, result: 'skipped', code: 'paused', reason: 'agent stock is not supported', alert: true };

  const plan = await evaluate({ db, chain, agent, user, stock, nowSec, liveCap });
  if (plan.ok && !plan.needed) return { agentId, result: 'not_needed' };
  if (!plan.ok) {
    const d = await recordDecision(db, { agentId, tickId: runId, now, code: plan.code, reason: plan.reason, facts: { ...plan, stock: stock.symbol } });
    return { agentId, result: decisionStateFor(plan.code), code: plan.code, reason: plan.reason, ...d };
  }

  // INV-4 lock. A second tick for this agent gets refill_in_flight here.
  let refill;
  try {
    refill = await createPlannedRefill(db, { agentId, tickId: runId, plannedUsdc: upperBound(plan.plannedUsdc), now });
  } catch (e) {
    if (e?.code === 'refill_in_flight') return { agentId, result: 'skipped', code: 'refill_in_flight', reason: e.message };
    throw e;
  }
  const at = () => new Date().toISOString();
  const fail = async (code, note, fields = {}) => {
    refill = await moveRefill(db, refill, decisionStateFor(code), { code, note, at: at(), fields });
    return { agentId, refillId: refill.refillId, result: refill.state, code, reason: note };
  };

  try {
    // Re-check with the lock held, with fresh DB records and fresh chain time (Checkpoint B #2, #6).
    agent = await db.collection('agents').findOne({ _id: agent._id });
    user = agent ? await loadUser(db, agent) : null;
    if (!agent || !user || agent.status !== 'active' || user.stoppedAt) return await fail('paused', 'agent or owner changed during the tick');
    nowSec = await chain.blockTime();
    const again = await evaluate({ db, chain, agent, user, stock, nowSec, excludeRefillId: refill.refillId, liveCap });
    if (!again.ok) return await fail(again.code, again.reason, pick(again));
    if (!again.needed) return await fail('refill_expired', 'balance is back above the floor; no longer needed', {});
    refill = await moveRefill(db, refill, 'checked', {
      at: at(),
      fields: { ...pick(again), stock: stock.symbol, permissionHash: again.permDoc.permissionHash, mode },
    });

    // Build the batch. Destination comes only from the DB record (INV-5).
    let needsApproval;
    try {
      needsApproval = !(await chain.isApproved(again.permission));
    } catch {
      return await fail('simulation_failed', 'could not read permission approval');
    }
    const calls = (await import('../chain/refillBatch.js')).buildRefillCalls({
      stock,
      permission: again.permission,
      signature: again.permDoc.signature,
      needsApproval,
      stockAmount: again.stockAmount,
      minOut: again.minOut,
      recipient: agent.walletAddress,
      deadline: (await chain.blockTime()) + EXECUTOR.deadlineSec,
      spender: config.spenderAddress,
    });

    let sim;
    try {
      sim = await chain.simulateRefill({ calls, agentWallet: agent.walletAddress });
    } catch (e) {
      sim = { ok: false, error: safeMessage(e, 'simulation error') };
    }
    if (!sim.ok || typeof sim.usdcOut !== 'bigint' || sim.usdcOut < again.minOut) {
      return await fail('simulation_failed', sim.error ? safeMessage(sim.error) : `simulated USDC ${sim.usdcOut ?? 'unknown'} below min-out`);
    }
    refill = await moveRefill(db, refill, 'simulated', { at: at(), fields: { simulatedUsdcOut: sim.usdcOut } });

    if (mode !== 'live') {
      return await fail('dry_run', `would sell ${again.stockAmount} ${stock.symbol} units for at least ${again.minOut} USDC units to ${agent.walletAddress}`);
    }

    // Last look at every control right before sending (INV-7), plus the live gate and cap (rollout step 4).
    const ctl = await readControls(db, chain, agent, again.permission, await chain.blockTime());
    if (ctl.decision !== 'ok') return await fail(ctl.code, ctl.reason);
    if (agentMode(tickMode, ctl.user, config) !== 'live') return await fail('paused', 'live mode is not enabled for this account');
    if (again.maxPayoutUsdc > liveCap) return await fail('limit_exceeded', 'over the live rollout cap per refill');

    // Mark sent BEFORE broadcasting: a crash after this leaves the agent locked (safe), never a second send.
    refill = await moveRefill(db, refill, 'sent', { at: at(), fields: { sentAt: at() } });
    const { userOpHash } = await chain.sendRefill({ calls, idempotencyKey: refill.refillId });
    try {
      await recordSendHash(db, refill.refillId, userOpHash);
    } catch (e) {
      // Checkpoint B #5: never lose the hash. It is not a secret; log it so the owner can find the op.
      console.error(`[executor] ALERT refill ${refill.refillId} sent as user op ${userOpHash} but the hash was not saved: ${safeMessage(e)}`);
      return { agentId, refillId: refill.refillId, result: 'sent', alert: true, userOpHash, reason: 'hash not saved; check by hand' };
    }
    refill = { ...refill, userOpHash };
    const settled = await settleSent(db, chain, { ...refill, agentId }, EXECUTOR.confirmTimeoutSec);
    return { agentId, refillId: refill.refillId, result: settled.state, txHash: settled.txHash ?? null, userOpHash };
  } catch (e) {
    // Anything unexpected before `sent`: release the lock as a retryable wait. After `sent`: leave it locked.
    if (['planned', 'checked', 'simulated'].includes(refill.state)) {
      console.error('[executor] error before send:', safeMessage(e));
      return await fail('simulation_failed', 'executor error before send; see server log');
    }
    console.error('[executor] ALERT error after send:', safeMessage(e));
    return { agentId, refillId: refill.refillId, result: refill.state, alert: true, error: e?.code ?? 'internal_error', reason: 'error after send; check by hand' };
  }
}

/**
 * Neediest agent first, so agents of one owner sharing a permission allowance don't starve an empty
 * wallet (owner report 2026-11-25). Order only: each agent's decision re-reads its balance fresh.
 * Sort key = USDC below floor (biggest gap first); unreadable balances go last; ties keep DB order.
 */
export async function orderByNeed(chain, agents) {
  const keyed = await Promise.all(
    agents.map(async (a, i) => {
      let gap;
      try {
        gap = BigInt(a.floorUsdc) - (await chain.readUsdcBalance(a.walletAddress));
      } catch {
        gap = null;
      }
      return { a, i, gap };
    }),
  );
  keyed.sort((x, y) => {
    if (x.gap === null || y.gap === null) return (x.gap === null) - (y.gap === null) || x.i - y.i;
    return x.gap === y.gap ? x.i - y.i : y.gap > x.gap ? 1 : -1;
  });
  return keyed.map((k) => k.a);
}

/**
 * One tick. mode: 'dry' (default, sends nothing) or 'live' (owner-enabled only).
 */
export async function runTick({ db, chain, config, mode = 'dry', now = new Date() }) {
  if (mode !== 'dry' && mode !== 'live') throw new HoldtilError('invalid_input', 'mode must be dry or live');
  const tickId = tickIdFor(now);
  const summary = { tickId, mode, at: now.toISOString(), recovered: { expired: 0, settled: [] }, agents: [] };

  const { expired } = await recoverStaleRefills(db, { now });
  summary.recovered.expired = expired.length;
  const sent = await db.collection(REFILLS).find({ state: 'sent' }).toArray();
  for (const r of sent) {
    try {
      summary.recovered.settled.push(await settleSent(db, chain, r));
      if (summary.recovered.settled.at(-1).alert) summary.alert = true;
    } catch (e) {
      summary.recovered.settled.push({ refillId: r.refillId, error: safeMessage(e) });
      summary.alert = true;
    }
  }

  const settings = await getSettings(db);
  if (settings.globalPause) {
    summary.paused = true;
    return summary;
  }

  // Checkpoint B #7: token decimals read on chain must match config, or nothing is sold this tick.
  // Every stock an active agent uses is checked (multi-stock, 2026-11-26).
  const activeStocks = await db.collection('agents').distinct('stock', { status: 'active' });
  const toCheck = new Set([STOCKS.NVDAc, ...activeStocks.map((sym) => (Object.hasOwn(STOCKS, sym) ? STOCKS[sym] : null)).filter(Boolean)]);
  try {
    for (const st of toCheck) {
      if ((await chain.readDecimals(st.address)) !== st.decimals) {
        summary.error = 'decimals_mismatch';
        return summary;
      }
    }
  } catch {
    summary.error = 'chain_unavailable';
    return summary;
  }
  // Checkpoint C #4: only agents whose owner has a signed permission and has not pressed Stop cost chain reads.
  const withPermission = new Set(await db.collection('permissions').distinct('userId', { status: 'signed' }));
  const stopped = new Set((await db.collection('users').find({ stoppedAt: { $ne: null } }).project({ _id: 1 }).toArray()).map((u) => String(u._id)));
  const all = await db.collection('agents').find({ status: 'active' }).toArray();
  // Cheap path, no chain reads: record why nothing happens (deduped hourly by recordDecision).
  for (const agent of all.filter((a) => stopped.has(a.userId) || !withPermission.has(a.userId))) {
    const agentId = String(agent._id);
    if (stopped.has(agent.userId)) {
      summary.agents.push({ agentId, result: 'skipped', code: 'paused', reason: 'owner pressed Stop' });
      continue;
    }
    const [code, reason] = ['permission_revoked', 'no signed spend permission'];
    try {
      const d = await recordDecision(db, { agentId, tickId: `${tickId}:${mode}`, now, code, reason, facts: {} });
      summary.agents.push({ agentId, result: decisionStateFor(code), code, reason, ...d });
    } catch (e) {
      summary.agents.push({ agentId, result: 'error', error: e?.code ?? 'internal_error', reason: safeMessage(e) });
    }
  }
  const agents = await orderByNeed(chain, all.filter((a) => withPermission.has(a.userId) && !stopped.has(a.userId)));
  for (const agent of agents) {
    try {
      summary.agents.push(await processAgent({ db, chain, config, agent, tickId, now, mode }));
    } catch (e) {
      summary.agents.push({ agentId: String(agent._id), result: 'error', error: e?.code ?? 'internal_error', reason: safeMessage(e) });
      summary.alert = true;
    }
    if (summary.agents.at(-1)?.alert) summary.alert = true;
  }
  return summary;
}
