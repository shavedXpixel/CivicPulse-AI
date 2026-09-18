import crypto from 'crypto';

/**
 * Canonical JSON serialization rules for deterministic hashing:
 * 1. Object keys are sorted lexicographically (recursive).
 * 2. Arrays of objects with an 'id' property are sorted by 'id' ascending.
 *    Arrays of primitives are sorted in natural ascending order.
 * 3. Dates and Firestore Timestamps are serialized as ISO 8601 UTC strings.
 * 4. Undefined values are omitted (standard JSON behavior).
 * 5. Numbers, booleans, and nulls are preserved canonically.
 * 6. Output is formatted with 2-space indentation and trailing newline '\n'.
 */

export function canonicalizeValue(val: any): any {
  if (val === null || val === undefined) {
    return val;
  }

  // Handle Firestore Timestamps or JavaScript Dates
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (typeof val === 'object' && '_seconds' in val && '_nanoseconds' in val) {
    const millis = val._seconds * 1000 + Math.floor(val._nanoseconds / 1000000);
    return new Date(millis).toISOString();
  }

  // Arrays
  if (Array.isArray(val)) {
    const canonicalArray = val.map(canonicalizeValue);
    // Sort array deterministically if elements have 'id'
    if (canonicalArray.length > 0 && canonicalArray.every(item => item && typeof item === 'object' && 'id' in item)) {
      return [...canonicalArray].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }
    // Sort primitive arrays
    if (canonicalArray.length > 0 && canonicalArray.every(item => typeof item === 'string' || typeof item === 'number')) {
      return [...canonicalArray].sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
      });
    }
    return canonicalArray;
  }

  // Objects
  if (typeof val === 'object') {
    const sortedKeys = Object.keys(val).sort();
    const sortedObj: Record<string, any> = {};
    for (const key of sortedKeys) {
      if (val[key] !== undefined) {
        sortedObj[key] = canonicalizeValue(val[key]);
      }
    }
    return sortedObj;
  }

  return val;
}

/**
 * Produces deterministic canonical JSON string.
 */
export function canonicalJsonStringify(val: any): string {
  const canonical = canonicalizeValue(val);
  return JSON.stringify(canonical, null, 2) + '\n';
}

/**
 * Computes SHA-256 hash of canonical UTF-8 string or buffer.
 */
export function computeSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
