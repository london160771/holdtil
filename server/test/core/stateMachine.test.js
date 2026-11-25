import { describe, it, expect } from 'vitest';
import { STATES, canTransition, transition, decisionStateFor } from '../../src/core/stateMachine.js';

const LEGAL = [
  ['planned', 'checked'], ['planned', 'waited'], ['planned', 'blocked'],
  ['checked', 'simulated'], ['checked', 'waited'], ['checked', 'blocked'],
  ['simulated', 'sent'], ['simulated', 'waited'], ['simulated', 'blocked'], ['sent', 'confirmed'], ['sent', 'failed'],
];

describe('refill state machine (PRD §11)', () => {
  it('allows exactly the legal transitions', () => {
    for (const from of STATES) {
      for (const to of STATES) {
        const legal = LEGAL.some(([a, b]) => a === from && b === to);
        expect(canTransition(from, to), `${from}→${to}`).toBe(legal);
      }
    }
  });

  it('illegal transitions throw illegal_transition', () => {
    const r = { refillId: 'x', state: 'planned', history: [] };
    expect(() => transition(r, 'sent')).toThrow(expect.objectContaining({ code: 'illegal_transition' }));
    expect(() => transition({ ...r, state: 'confirmed' }, 'planned')).toThrow(expect.objectContaining({ code: 'illegal_transition' }));
    expect(() => transition({ ...r, state: 'sent' }, 'checked')).toThrow(expect.objectContaining({ code: 'illegal_transition' }));
  });

  it('waited/blocked/failed need a code', () => {
    const r = { refillId: 'x', state: 'planned', history: [] };
    expect(() => transition(r, 'waited')).toThrow(expect.objectContaining({ code: 'illegal_transition' }));
  });

  it('logs every transition and does not mutate the input', () => {
    const r0 = { refillId: 'x', state: 'planned', history: [] };
    const r1 = transition(r0, 'checked', { at: 't1' });
    const r2 = transition(r1, 'waited', { at: 't2', code: 'price_gap_too_wide' });
    expect(r0.state).toBe('planned');
    expect(r2.state).toBe('waited');
    expect(r2.code).toBe('price_gap_too_wide');
    expect(r2.history).toEqual([
      { from: 'planned', to: 'checked', at: 't1', code: null, note: null },
      { from: 'checked', to: 'waited', at: 't2', code: 'price_gap_too_wide', note: null },
    ]);
  });

  it('retryable codes → waited, others → blocked', () => {
    expect(decisionStateFor('price_stale')).toBe('waited');
    expect(decisionStateFor('price_gap_too_wide')).toBe('waited');
    expect(decisionStateFor('simulation_failed')).toBe('waited');
    expect(decisionStateFor('limit_exceeded')).toBe('blocked');
    expect(decisionStateFor('paused')).toBe('blocked');
    expect(decisionStateFor('permission_revoked')).toBe('blocked');
    expect(() => decisionStateFor('nope')).toThrow();
  });
});
