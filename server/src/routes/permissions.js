// Spend Permissions (PRD FR-PRM-001/002, §14). The user signs in their own Base Account; we store the
// signed permission and check it on chain. Nothing is spent here.
import { Router } from 'express';
import { getAddress, isAddress } from 'viem';
import { HoldtilError } from '../errors.js';
import { requireUser, requireOnboarded } from '../auth/session.js';
import { STOCKS } from '../config/addresses.js';
import { PERMISSION_RULES } from '../config/limits.js';

const invalid = (msg) => new HoldtilError('permission_invalid', msg, { status: 400 });
const STOCK_BY_ADDRESS = new Map(Object.values(STOCKS).map((s) => [s.address.toLowerCase(), s]));

const uintStr = (v, name, max) => {
  const s = typeof v === 'number' && Number.isSafeInteger(v) ? String(v) : v;
  if (typeof s !== 'string' || !/^\d{1,78}$/.test(s)) throw invalid(`${name} must be a whole number`);
  const n = BigInt(s);
  if (max !== undefined && n > max) throw invalid(`${name} is too large`);
  return n;
};

/** Validates the signed permission body and returns a typed permission (bigints/numbers as the ABI wants). */
export function parsePermission(body, { userAddress, spenderAddress, nowSec }) {
  const p = body?.permission;
  if (!p || typeof p !== 'object') throw invalid('permission is required');
  for (const k of ['account', 'spender', 'token']) {
    if (typeof p[k] !== 'string' || !isAddress(p[k], { strict: false })) throw invalid(`${k} is not an address`);
  }
  const permission = {
    account: getAddress(p.account),
    spender: getAddress(p.spender),
    token: getAddress(p.token),
    allowance: uintStr(p.allowance, 'allowance', 2n ** 160n - 1n),
    period: Number(uintStr(p.period, 'period', 2n ** 48n - 1n)),
    start: Number(uintStr(p.start, 'start', 2n ** 48n - 1n)),
    end: Number(uintStr(p.end, 'end', 2n ** 48n - 1n)),
    salt: uintStr(p.salt ?? '0', 'salt', 2n ** 256n - 1n),
    extraData: p.extraData ?? '0x',
  };
  if (typeof permission.extraData !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(permission.extraData) || permission.extraData.length > 2 + 2 * 256) {
    throw invalid('extraData must be hex');
  }
  if (permission.account.toLowerCase() !== userAddress) throw invalid('the permission must come from your own signed-in account');
  if (!spenderAddress || permission.spender !== getAddress(spenderAddress)) throw invalid('the spender must be Holdtil');
  if (!STOCK_BY_ADDRESS.has(permission.token.toLowerCase())) throw invalid('this token is not supported');
  if (permission.allowance === 0n) throw invalid('allowance must be above 0');
  if (permission.period < PERMISSION_RULES.minPeriodSec || permission.period > PERMISSION_RULES.maxPeriodSec) throw invalid('period is out of range');
  if (permission.end <= permission.start) throw invalid('end must be after start');
  if (BigInt(permission.end) <= nowSec) throw invalid('permission already expired');
  if (permission.end - permission.start > PERMISSION_RULES.maxLifetimeSec) throw invalid('permission lasts too long');
  if (typeof body.signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(body.signature) || body.signature.length > 20_000) throw invalid('signature is missing');
  return permission;
}

const toDb = (p) => ({ ...p, allowance: p.allowance.toString(), salt: p.salt.toString() });
export const fromDb = (d) => ({
  account: d.account, spender: d.spender, token: d.token, allowance: BigInt(d.allowance), period: d.period,
  start: d.start, end: d.end, salt: BigInt(d.salt), extraData: d.extraData,
});

export function permissionRoutes({ db, config, chain }) {
  const r = Router();
  r.use(requireUser(db));

  r.post('/', requireOnboarded, async (req, res) => {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const permission = parsePermission(req.body, { userAddress: req.user.address, spenderAddress: config.spenderAddress, nowSec });
    let ok;
    try {
      ok = await chain.verifyPermissionSignature(permission, req.body.signature);
    } catch {
      ok = false;
    }
    if (!ok) throw invalid('the signature does not match this permission and account');
    const hash = chain.permissionHash(permission);
    const doc = {
      userId: String(req.user._id),
      permission: toDb(permission),
      token: permission.token,
      symbol: STOCK_BY_ADDRESS.get(permission.token.toLowerCase()).symbol,
      permissionHash: hash,
      signature: req.body.signature,
      status: 'signed',
      createdAt: new Date(),
    };
    try {
      await db.collection('permissions').insertOne(doc);
    } catch (e) {
      if (e?.code === 11000) throw invalid('this permission is already saved');
      throw e;
    }
    res.status(201).json({ permission: { permissionHash: hash, symbol: doc.symbol, ...doc.permission, status: doc.status } });
  });

  // Live status + remaining allowance from chain. "unavailable" if the chain can't be read.
  r.get('/', async (req, res) => {
    const list = await db.collection('permissions').find({ userId: String(req.user._id) }).sort({ createdAt: -1 }).limit(20).toArray();
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const out = await Promise.all(
      list.map(async (d) => {
        let live;
        try {
          const s = await chain.readPermissionStatus(fromDb(d.permission), nowSec);
          live = { status: s.status, remaining: s.remaining.toString(), spentThisPeriod: s.spentThisPeriod?.toString() ?? null };
        } catch {
          live = { status: 'unavailable', remaining: 'unavailable', spentThisPeriod: 'unavailable' };
        }
        return { permissionHash: d.permissionHash, symbol: d.symbol, ...d.permission, createdAt: d.createdAt, ...live };
      }),
    );
    res.json({ permissions: out });
  });

  return r;
}
