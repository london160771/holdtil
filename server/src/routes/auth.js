// Sign in with Base (PRD FR-AUTH-001, §14). SIWE message + smart-wallet-aware signature check.
// Replay protection: each nonce is single use, consumed atomically, and expires after 10 minutes.
import { Router } from 'express';
import { generateSiweNonce, parseSiweMessage, validateSiweMessage } from 'viem/siwe';
import { getAddress, isAddress } from 'viem';
import { CHAIN_ID } from '../config/addresses.js';
import { HoldtilError } from '../errors.js';
import { createSession, destroySession } from '../auth/session.js';

const NONCE_TTL_MS = 10 * 60 * 1000;
const fail = (msg) => new HoldtilError('auth_failed', msg, { status: 401 });

export function authRoutes({ db, config, chain }) {
  const r = Router();

  r.get('/nonce', async (_req, res) => {
    const nonce = generateSiweNonce();
    await db.collection('nonces').insertOne({ nonce, expiresAt: new Date(Date.now() + NONCE_TTL_MS), createdAt: new Date() });
    res.json({ nonce });
  });

  r.post('/verify', async (req, res) => {
    const { address, message, signature } = req.body ?? {};
    if (typeof message !== 'string' || message.length > 4000 || typeof signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signature)) {
      throw fail('Missing or bad message/signature');
    }
    if (typeof address !== 'string' || !isAddress(address, { strict: false })) throw fail('Bad address');

    let parsed;
    try {
      parsed = parseSiweMessage(message);
    } catch {
      throw fail('Unreadable sign-in message');
    }
    if (!parsed.address || getAddress(parsed.address) !== getAddress(address)) throw fail('Address does not match the message');
    if (parsed.chainId !== CHAIN_ID) throw fail('Wrong network');
    if (parsed.uri !== config.appOrigin && !String(parsed.uri ?? '').startsWith(`${config.appOrigin}/`)) throw fail('Wrong site');
    const valid = validateSiweMessage({ message: parsed, domain: config.appDomain, time: new Date() });
    if (!valid) throw fail('Message expired, not yet valid, or for another site');

    // Consume the nonce atomically: a replayed message finds nothing.
    const used = await db.collection('nonces').findOneAndDelete({ nonce: parsed.nonce, expiresAt: { $gt: new Date() } });
    if (!used) throw fail('Sign-in request expired or already used');

    let ok;
    try {
      ok = await chain.verifySiwe({ address: getAddress(address), message, signature });
    } catch {
      ok = false;
    }
    if (!ok) throw fail('Signature check failed');

    const addr = getAddress(address).toLowerCase();
    const user = await db.collection('users').findOneAndUpdate(
      { address: addr },
      { $setOnInsert: { address: addr, createdAt: new Date(), notUsConfirmedAt: null, termsAcceptedAt: null, stoppedAt: null } },
      { upsert: true, returnDocument: 'after' },
    );
    await createSession(db, res, String(user._id), { secure: config.cookieSecure });
    res.json({ ok: true, address: addr });
  });

  r.post('/logout', async (req, res) => {
    await destroySession(db, req, res, { secure: config.cookieSecure });
    res.json({ ok: true });
  });

  return r;
}
