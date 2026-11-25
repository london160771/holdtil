// The handler must use Holdtil's exact rule (PRD §16). Fails if a copy or a constant drifts from the server.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SYNCED } from '../scripts/sync.js';
import { ADDRESSES, STOCKS as SERVER_STOCKS } from '../../server/src/config/addresses.js';
import { EXECUTOR } from '../../server/src/config/executor.js';
import { AERO_CL_QUOTER, RULE, STOCKS, USDC } from '../x402/fair-price/constants.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('handler stays in sync with the server', () => {
  it.each(SYNCED)('lib/%s is an exact copy of server/src/core (run npm run bankr:sync)', (f) => {
    expect(readFileSync(join(root, 'bankr/x402/fair-price/lib', f), 'utf8')).toBe(readFileSync(join(root, 'server/src/core', f), 'utf8'));
  });

  it('addresses match server/src/config/addresses.js', () => {
    expect(USDC).toBe(ADDRESSES.USDC);
    expect(AERO_CL_QUOTER).toBe(ADDRESSES.AERO_CL_QUOTER);
    for (const [k, s] of Object.entries(STOCKS)) {
      const t = SERVER_STOCKS[k];
      expect(s.address).toBe(t.address);
      expect(s.feed).toBe(t.feed);
      expect(s.pool.address).toBe(t.pool.address);
      expect(s.pool.tickSpacing).toBe(t.pool.tickSpacing);
    }
  });

  it('rule settings match server/src/config/executor.js', () => {
    for (const k of Object.keys(RULE)) expect(RULE[k]).toBe(EXECUTOR[k]);
  });

  it('handler imports stay inside the service folder (Bankr rejects others)', () => {
    for (const f of ['index.ts', 'check.js']) {
      const src = readFileSync(join(root, 'bankr/x402/fair-price', f), 'utf8');
      for (const m of src.matchAll(/from '(\.[^']*)'/g)) expect(m[1].startsWith('./')).toBe(true);
    }
  });
});
