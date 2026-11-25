// Base Builder Codes (ERC-8021): an attribution tag appended to the calldata of Holdtil's refill user ops,
// so Base can count that onchain activity as Holdtil's. Attribution only: contracts ignore the extra bytes,
// and it never changes what a refill sells, where it sends, or how much (PRD §15, §16).
// Source: https://docs.base.org/apps/builder-codes/app-developers
import { Attribution } from 'ox/erc8021';

// Codes from Base Dashboard look like "bc_b7k3p9da". ERC-8021 joins codes with commas, so no commas or spaces.
const CODE_RE = /^[A-Za-z0-9_]{1,32}$/;

/** ERC-8021 data suffix for one builder code, or undefined when no code is set. Throws on a malformed code. */
export function builderCodeSuffix(code) {
  const c = (code ?? '').trim();
  if (!c) return undefined;
  if (!CODE_RE.test(c)) throw new Error('BUILDER_CODE must be letters, digits or _ (max 32), e.g. bc_b7k3p9da');
  return Attribution.toDataSuffix({ codes: [c] });
}

/** Appends the suffix to calldata (hex). No suffix = calldata unchanged. */
export function withSuffix(data, suffix) {
  return suffix ? `${data}${suffix.slice(2)}` : data;
}
