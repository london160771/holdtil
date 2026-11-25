// Simple fixed-window rate limit per client IP, in memory (PRD §12: auth and write endpoints).
// One API instance on Render, so memory is enough. Behind Render's proxy req.ip comes from
// X-Forwarded-For because app.set('trust proxy', 1).
import { HoldtilError } from './errors.js';

/**
 * @param {{ windowMs: number, max: number, methods?: string[], now?: () => number }} opts
 * methods: only these HTTP methods count (default: all).
 */
export function rateLimit({ windowMs, max, methods, now = Date.now }) {
  const hits = new Map(); // ip -> { start, count }
  let lastSweep = now();
  return (req, res, next) => {
    if (methods && !methods.includes(req.method)) return next();
    const t = now();
    if (t - lastSweep > windowMs) {
      for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
      lastSweep = t;
    }
    const key = req.ip || 'unknown';
    let h = hits.get(key);
    if (!h || t - h.start >= windowMs) {
      h = { start: t, count: 0 };
      hits.set(key, h);
    }
    h.count += 1;
    if (h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.start + windowMs - t) / 1000)));
      return next(new HoldtilError('rate_limited', 'Too many requests. Wait a minute and try again', { status: 429 }));
    }
    next();
  };
}
