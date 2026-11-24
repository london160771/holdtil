// Runs every Gate 0 check and prints one JSON report (PRD §16). Sends no transaction.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readPriceAndQuote } from './price-and-quote.js';
import { runSpendBatchSim } from './spend-batch-sim.js';
import { getSpender } from './cdp-spender.js';
import { toJson } from './lib.js';

const here = path.dirname(fileURLToPath(import.meta.url));

async function step(name, fn) {
  try {
    return { name, ok: true, result: await fn() };
  } catch (e) {
    return { name, ok: false, error: e.message };
  }
}

const report = { at: new Date().toISOString(), steps: [] };
report.steps.push(await step('#3 + #4 price feed and DEX quote', readPriceAndQuote));
report.steps.push(await step('#1 + #2 spend permission + atomic batch (simulated)', runSpendBatchSim));
report.steps.push(
  await step('#5 x402 dry check', async () => {
    const script = path.resolve(here, '../../../scout/scripts/x402-dry-check.js');
    const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim());
    return JSON.parse(r.stdout);
  }),
);
report.steps.push(await step('CDP spender account (public addresses only)', getSpender));
console.log(toJson(report));
