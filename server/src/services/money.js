// Parse/print money at the API edge (INV-1). The API takes and returns base-unit decimal strings.
import { HoldtilError } from '../errors.js';

export function parseUnitsString(v, name, { min = 0n, max } = {}) {
  if (typeof v !== 'string' || !/^\d{1,30}$/.test(v)) {
    throw new HoldtilError('invalid_input', `${name} must be a whole number of base units, as a string`);
  }
  const n = BigInt(v);
  if (n < min) throw new HoldtilError('invalid_input', `${name} is too small`);
  if (max !== undefined && n > max) throw new HoldtilError('invalid_input', `${name} is above the current limit of ${max} base units`);
  return n;
}

/** Converts known money fields of a DB doc to strings for JSON (they already are strings in the DB). */
export const str = (v) => (v === null || v === undefined ? null : String(v));
