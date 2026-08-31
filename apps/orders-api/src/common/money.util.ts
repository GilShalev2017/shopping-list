/**
 * Rounds a monetary amount to 2 decimal places (ILS agorot).
 *
 * `Number.EPSILON` compensates for binary floating point representations that
 * sit a hair below the .5 boundary — without it `round2(1.005)` yields `1`
 * instead of `1.01`, and `0.1 * 3` style sums drift.
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`Cannot round a non-finite amount: ${value}`);
  }
  const scaled = value * 100;
  // Nudge by one ULP in the direction of the value's sign before rounding.
  const corrected =
    scaled >= 0
      ? scaled + Number.EPSILON * Math.abs(scaled)
      : scaled - Number.EPSILON * Math.abs(scaled);
  return Math.round(corrected) / 100;
}

/** Sums an already-rounded list of amounts, re-rounding to kill drift. */
export function sumMoney(values: readonly number[]): number {
  return round2(values.reduce((total, value) => total + value, 0));
}
