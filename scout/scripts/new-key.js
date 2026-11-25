// Creates Scout's own wallet key and saves it to scout/.env as SCOUT_PRIVATE_KEY.
// Prints ONLY the public address. Refuses if a key is already set (never overwrites a wallet).
import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const current = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const existing = current.match(/^SCOUT_PRIVATE_KEY=(0x[0-9a-fA-F]{64})\s*$/m);
if (existing) {
  console.log(`scout/.env already has a key. Scout address: ${privateKeyToAccount(existing[1]).address}`);
  process.exit(0);
}
const key = generatePrivateKey();
const line = `SCOUT_PRIVATE_KEY=${key}\n`;
if (/^SCOUT_PRIVATE_KEY=\s*$/m.test(current)) writeFileSync(envPath, current.replace(/^SCOUT_PRIVATE_KEY=\s*$/m, line.trimEnd()));
else appendFileSync(envPath, (current && !current.endsWith('\n') ? '\n' : '') + line);
console.log(`Saved a new key to scout/.env (not shown). Scout address: ${privateKeyToAccount(key).address}`);
