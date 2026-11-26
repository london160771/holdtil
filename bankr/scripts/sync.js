// Copies Holdtil's price rule files from server/src/core into the Bankr handler folder (PRD §16, FR-FPC-001).
// Bankr rejects imports outside the service folder, so the handler carries exact copies. test/sync.test.js
// fails if a copy drifts from the server file. Run: npm run bankr:sync
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SYNCED = ['money.js', 'priceGuard.js', 'refillPlanner.js'];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const f of SYNCED) {
    copyFileSync(join(root, 'server/src/core', f), join(root, 'bankr/x402/fair-price/lib', f));
    console.log('copied', f);
  }
}
