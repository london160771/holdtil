// MongoDB connection and indexes (PRD §14). Unique indexes do the safety work (CLAUDE.md §7).
import { MongoClient } from 'mongodb';
import { ensureRefillIndexes } from './refills.js';

export async function connectDb(uri, dbName) {
  const client = await MongoClient.connect(uri);
  return { client, db: client.db(dbName) };
}

export async function ensureIndexes(db) {
  await db.collection('users').createIndex({ address: 1 }, { unique: true, name: 'address_unique' });
  await db.collection('agents').createIndex({ userId: 1, walletAddress: 1 }, { unique: true, name: 'user_wallet_unique' });
  await db.collection('permissions').createIndex({ permissionHash: 1 }, { unique: true, name: 'hash_unique' });
  await db.collection('permissions').createIndex({ userId: 1, createdAt: -1 }, { name: 'user_recent' });
  await db.collection('nonces').createIndex({ nonce: 1 }, { unique: true, name: 'nonce_unique' });
  await db.collection('nonces').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'nonce_ttl' });
  await db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true, name: 'token_unique' });
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'session_ttl' });
  await db.collection('scoutRuns').createIndex({ runId: 1 }, { unique: true, name: 'runId_unique' });
  await db.collection('scoutRuns').createIndex({ createdAt: -1 }, { name: 'recent' });
  await db.collection('fairPriceChecks').createIndex({ checkId: 1 }, { unique: true, name: 'checkId_unique' });
  await db.collection('fairPriceChecks').createIndex({ createdAt: -1 }, { name: 'recent' });
  await ensureRefillIndexes(db);
}

/** Global pause flag (INV-7). Missing document = not paused; read errors throw (callers fail closed). */
export async function getSettings(db) {
  const s = await db.collection('settings').findOne({ _id: 'global' });
  return { globalPause: Boolean(s?.globalPause) };
}
