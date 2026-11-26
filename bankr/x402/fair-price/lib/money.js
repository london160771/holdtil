// Money helpers (PRD §11 INV-1). bigint only, token base units. No floats.

/** Throws unless v is a bigint >= 0. */
export function assertUnits(v, name) {
  if (typeof v !== 'bigint' || v < 0n) throw new TypeError(`${name} must be a non-negative bigint`);
  return v;
}

export function ceilDiv(a, b) {
  if (b <= 0n) throw new RangeError('division by zero or negative');
  return (a + b - 1n) / b;
}

export const min = (a, b) => (a < b ? a : b);
export const max = (a, b) => (a > b ? a : b);
export const pow10 = (n) => 10n ** BigInt(n);
