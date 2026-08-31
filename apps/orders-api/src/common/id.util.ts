import { randomBytes, randomInt } from 'node:crypto';

/**
 * Crockford base32 alphabet (no I, L, O, U) — the ULID spec alphabet.
 * @see https://github.com/ulid/spec
 */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const TIME_LEN = 10;
const RANDOM_LEN = 16;

/** Matches a canonical 26-character ULID. */
export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Matches the human-facing order reference, e.g. `ORD-8F3A21`. */
export const ORDER_REFERENCE_PATTERN = /^ORD-[0-9A-F]{6}$/;

function encodeTime(now: number, length: number): string {
  let time = now;
  let out = '';
  for (let i = length - 1; i >= 0; i--) {
    const mod = time % 32;
    out = CROCKFORD[mod] + out;
    time = (time - mod) / 32;
  }
  return out;
}

function encodeRandom(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CROCKFORD[randomInt(0, CROCKFORD.length)];
  }
  return out;
}

/**
 * Generates a ULID: 48-bit millisecond timestamp + 80 bits of randomness,
 * Crockford base32 encoded. Lexicographically sortable by creation time, which
 * is exactly what we want for an id that also acts as the Elasticsearch `_id`.
 *
 * Hand-rolled (≈20 lines) rather than pulling in a dependency for it.
 */
export function ulid(now: number = Date.now()): string {
  return encodeTime(now, TIME_LEN) + encodeRandom(RANDOM_LEN);
}

/**
 * Short, human-readable order reference shown on the confirmation screen:
 * `ORD-` plus 6 uppercase hex characters (24 bits ≈ 16.7M combinations).
 */
export function orderReference(): string {
  return `ORD-${randomBytes(3).toString('hex').toUpperCase()}`;
}
