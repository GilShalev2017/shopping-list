import { ORDER_REFERENCE_PATTERN, ULID_PATTERN, orderReference, ulid } from './id.util';

describe('id.util', () => {
  describe('ulid', () => {
    it('produces a canonical 26-character Crockford base32 id', () => {
      const id = ulid();
      expect(id).toHaveLength(26);
      expect(id).toMatch(ULID_PATTERN);
    });

    it('never emits the ambiguous letters I, L, O or U', () => {
      const sample = Array.from({ length: 200 }, () => ulid()).join('');
      expect(sample).not.toMatch(/[ILOU]/);
    });

    it('is lexicographically sortable by creation time', () => {
      const earlier = ulid(1_700_000_000_000);
      const later = ulid(1_700_000_001_000);
      expect(earlier < later).toBe(true);
      expect(earlier.slice(0, 10)).not.toBe(later.slice(0, 10));
    });

    it('encodes the same timestamp identically', () => {
      expect(ulid(1_700_000_000_000).slice(0, 10)).toBe(
        ulid(1_700_000_000_000).slice(0, 10),
      );
    });

    it('is collision-free across a large sample', () => {
      const ids = new Set(Array.from({ length: 5_000 }, () => ulid()));
      expect(ids.size).toBe(5_000);
    });
  });

  describe('orderReference', () => {
    it('matches ORD- plus six uppercase hex characters', () => {
      expect(orderReference()).toMatch(ORDER_REFERENCE_PATTERN);
      expect(orderReference()).toHaveLength(10);
    });

    it('varies between calls', () => {
      const references = new Set(Array.from({ length: 500 }, () => orderReference()));
      // 24 bits of entropy: 500 draws colliding more than a handful of times
      // would indicate the generator is not random.
      expect(references.size).toBeGreaterThan(495);
    });
  });
});
