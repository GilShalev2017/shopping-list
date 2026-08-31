import { round2, sumMoney } from './money.util';

describe('money.util', () => {
  describe('round2', () => {
    it.each([
      [0, 0],
      [6.9, 6.9],
      [13.8, 13.8],
      [1.005, 1.01], // classic float boundary: 1.005 * 100 === 100.49999999999999
      [2.675, 2.68],
      [0.615, 0.62],
      [1.0049999, 1.0],
      [19.999, 20],
      [0.1 + 0.2, 0.3],
      [3 * 19.9, 59.7],
      [-1.005, -1.01],
      [-0.004, -0],
      [1234567.891, 1234567.89],
    ])('rounds %p to %p', (input, expected) => {
      expect(round2(input)).toBe(expected);
    });

    it('is idempotent', () => {
      const once = round2(7 * 4.15);
      expect(round2(once)).toBe(once);
    });

    it.each([NaN, Infinity, -Infinity])('throws on %p', (input) => {
      expect(() => round2(input)).toThrow(TypeError);
    });
  });

  describe('sumMoney', () => {
    it('sums an empty list to zero', () => {
      expect(sumMoney([])).toBe(0);
    });

    it('does not accumulate float drift', () => {
      expect(sumMoney(Array.from({ length: 10 }, () => 0.1))).toBe(1);
    });

    it('sums realistic line totals', () => {
      expect(sumMoney([13.8, 5.5, 24.9, 0.99])).toBe(45.19);
    });
  });
});
