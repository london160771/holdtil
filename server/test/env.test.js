import { describe, it, expect } from 'vitest';
import { missingEnv } from '../src/config/env.js';

describe('env', () => {
  it('reports missing names only', () => {
    expect(missingEnv(['A', 'B', 'C'], { A: 'x', B: '  ' })).toEqual(['B', 'C']);
  });
});
