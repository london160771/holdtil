// POST /internal/tick (PRD §14). Called by cron-job.org every 5 minutes with the secret header.
import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { HoldtilError } from '../errors.js';
import { runTick } from '../executor/tick.js';

const digest = (s) => createHash('sha256').update(String(s)).digest();

export function tickRoutes({ db, config, executorChain }) {
  const r = Router();
  r.post('/tick', async (req, res) => {
    const given = req.get('x-tick-secret') ?? '';
    if (!config.tickSecret || !timingSafeEqual(digest(given), digest(config.tickSecret))) {
      throw new HoldtilError('auth_failed', 'Bad tick secret', { status: 401 });
    }
    if (!executorChain) throw new HoldtilError('internal_error', 'executor not configured', { status: 500 });
    const summary = await runTick({ db, chain: executorChain, config, mode: config.executorMode });
    // Alerts and tick-level errors answer 500 so cron-job.org marks the run failed and emails the owner
    // (Checkpoint C #6). The body still has the full summary.
    res.status(summary.alert || summary.error ? 500 : 200).json(JSON.parse(JSON.stringify(summary, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))));
  });
  return r;
}
