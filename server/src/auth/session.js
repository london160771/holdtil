// Sessions: random token in an httpOnly cookie; only its SHA-256 hash is stored (PRD §12).
// Logout deletes the row, so a stolen cookie stops working at once.
import { randomBytes, createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { HoldtilError } from '../errors.js';

export const COOKIE = 'holdtil_session';
const TTL_MS = 7 * 24 * 3600 * 1000;

const hash = (t) => createHash('sha256').update(t).digest('hex');

export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export async function createSession(db, res, userId, { secure }) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.collection('sessions').insertOne({ tokenHash: hash(token), userId, expiresAt, createdAt: new Date() });
  res.cookie(COOKIE, token, { httpOnly: true, secure, sameSite: 'lax', path: '/', expires: expiresAt });
}

export async function destroySession(db, req, res, { secure }) {
  const token = readCookie(req, COOKIE);
  if (token) await db.collection('sessions').deleteOne({ tokenHash: hash(token) });
  res.clearCookie(COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
}

/** Middleware: loads req.user or answers 401 auth_failed. */
export function requireUser(db) {
  return async (req, _res, next) => {
    const token = readCookie(req, COOKIE);
    if (!token) throw new HoldtilError('auth_failed', 'Sign in first', { status: 401 });
    const s = await db.collection('sessions').findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } });
    if (!s) throw new HoldtilError('auth_failed', 'Session expired. Sign in again', { status: 401 });
    const user = await db.collection('users').findOne({ _id: new ObjectId(s.userId) });
    if (!user) throw new HoldtilError('auth_failed', 'Account not found', { status: 401 });
    req.user = user;
    next();
  };
}

/** Middleware: FR-AUTH-002 — no agent or permission before not-US + terms. */
export function requireOnboarded(req, _res, next) {
  if (!req.user?.notUsConfirmedAt || !req.user?.termsAcceptedAt) {
    throw new HoldtilError('onboarding_required', 'Confirm you are not a US person and accept the terms first', { status: 403 });
  }
  next();
}
