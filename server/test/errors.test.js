import { describe, it, expect } from 'vitest';
import { CODES, HoldtilError } from '../src/errors.js';

describe('error codes (PRD §11)', () => {
  it('every code has retryable and nextAction', () => {
    for (const [code, meta] of Object.entries(CODES)) {
      expect(typeof meta.retryable, code).toBe('boolean');
      expect(meta.nextAction.length, code).toBeGreaterThan(0);
    }
  });

  it('unknown codes throw', () => {
    expect(() => new HoldtilError('made_up')).toThrow();
  });
});
