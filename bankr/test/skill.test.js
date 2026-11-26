// The Holdtil skill for Bankr agents (PRD FR-BKS-001): format checks against Bankr's skill rules, and the
// numbers in SKILL.md must match the fair-price check they rely on.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STOCKS, RULE } from '../x402/fair-price/constants.js';
import { MIN_USDC } from '../x402/fair-price/check.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'holdtil');
const skill = readFileSync(join(dir, 'SKILL.md'), 'utf8');
const catalog = JSON.parse(readFileSync(join(dir, 'catalog.json'), 'utf8'));

describe('Holdtil skill for Bankr', () => {
  it('SKILL.md has name + description frontmatter (Bankr skips a skill without a description)', () => {
    const fm = skill.match(/^---\n([\s\S]*?)\n---\n/);
    expect(fm).not.toBeNull();
    expect(fm[1]).toMatch(/^name: holdtil$/m);
    expect(fm[1]).toMatch(/^description: .{40,}$/m);
  });

  it('catalog.json slug equals the folder name and points at existing files', () => {
    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.slug).toBe('holdtil');
    expect(catalog.install.repoPath).toBe('holdtil');
    expect(existsSync(join(dir, catalog.logo))).toBe(true);
  });

  it('stays inside Bankr size limits (SKILL.md 1 MB, each reference 100 KB)', () => {
    expect(statSync(join(dir, 'SKILL.md')).size).toBeLessThan(1_000_000);
    expect(statSync(join(dir, 'references/how-it-works.md')).size).toBeLessThan(100_000);
  });

  it('names the real Base NVDAc token, not a lookalike', () => {
    expect(skill).toContain(STOCKS.NVDAc.address);
  });

  it('uses the check’s fair floor and the same limits as the check', () => {
    expect(skill).toContain('sell.fairFloorUsdc');
    expect(skill).toContain('below 0.10');
    expect(MIN_USDC).toBe(100_000n);
    expect(skill).toMatch(/1 hour old/);
    expect(RULE.maxPriceAgeSec).toBe(3600n);
    expect(skill).toMatch(/within 1%/);
    expect(RULE.maxGapBps).toBe(100n);
  });

  it('keeps the safety rules: never sell without a fresh sell verdict, one swap, own wallet only', () => {
    for (const rule of ['Never sell without a `sell` verdict', 'Never send the USDC anywhere but this wallet', 'never send a second swap', 'Only the owner\'s own messages']) {
      expect(skill).toContain(rule);
    }
  });
});
