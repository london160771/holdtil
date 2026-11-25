import { describe, it, expect, vi } from 'vitest';
import { Attribution } from 'ox/erc8021';
import { builderCodeSuffix, withSuffix } from '../src/chain/builderCode.js';
import { loadConfig } from '../src/config/env.js';
import { executorChain } from '../src/chain/executorChain.js';

// Example from docs.base.org/apps/builder-codes/app-developers (bc_b7k3p9da).
const DOC_SUFFIX = '0x62635f62376b33703964610b0080218021802180218021802180218021';

describe('Base Builder Code (ERC-8021)', () => {
  it('matches the suffix in the Base docs', () => {
    expect(builderCodeSuffix('bc_b7k3p9da')).toBe(DOC_SUFFIX);
  });

  it('round-trips: the tagged calldata decodes back to our code', () => {
    const tagged = withSuffix('0xdeadbeef', builderCodeSuffix('bc_b7k3p9da'));
    expect(tagged.startsWith('0xdeadbeef')).toBe(true);
    expect(Attribution.fromData(tagged)?.codes).toEqual(['bc_b7k3p9da']);
  });

  it('no code = no suffix, calldata unchanged', () => {
    expect(builderCodeSuffix('')).toBeUndefined();
    expect(builderCodeSuffix(undefined)).toBeUndefined();
    expect(withSuffix('0xabcd', undefined)).toBe('0xabcd');
  });

  it('a malformed code stops config loading (no silent drop)', () => {
    expect(() => builderCodeSuffix('bc_a,bc_b')).toThrow(/BUILDER_CODE/);
    expect(() => builderCodeSuffix('has space')).toThrow(/BUILDER_CODE/);
    expect(() => loadConfig({ BUILDER_CODE: 'x'.repeat(33) })).toThrow(/BUILDER_CODE/);
  });

  it('config exposes the code and its suffix', () => {
    const c = loadConfig({ BUILDER_CODE: ' bc_b7k3p9da ' });
    expect(c.builderCode).toBe('bc_b7k3p9da');
    expect(c.dataSuffix).toBe(DOC_SUFFIX);
    expect(loadConfig({}).dataSuffix).toBeUndefined();
  });

  it('sendRefill passes the suffix to CDP sendUserOperation, and leaves it out when unset', async () => {
    const send = vi.fn(async () => ({ userOpHash: '0x01' }));
    const loadSpenderFn = async () => ({ smartAccount: { address: '0xS' }, cdp: { evm: { sendUserOperation: send } } });
    const calls = [{ to: '0x0000000000000000000000000000000000000001', value: 0n, data: '0x' }];

    await executorChain({}, { spenderAddress: '0xS', dataSuffix: DOC_SUFFIX, loadSpenderFn }).sendRefill({ calls, idempotencyKey: 'r1' });
    expect(send.mock.calls[0][0].dataSuffix).toBe(DOC_SUFFIX);
    expect(send.mock.calls[0][0].calls).toBe(calls);

    await executorChain({}, { spenderAddress: '0xS', loadSpenderFn }).sendRefill({ calls, idempotencyKey: 'r1' });
    expect('dataSuffix' in send.mock.calls[1][0]).toBe(false);
  });
});
