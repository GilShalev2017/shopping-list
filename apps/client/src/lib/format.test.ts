import { describe, expect, it, vi } from 'vitest';
import { UNIT_KEYS, formatCurrency, formatDateTime, localizedName, round2 } from './format';
import { dairyCategory, milk } from '@/test/fixtures';

describe('localizedName', () => {
  it('returns the Hebrew name for the he locale', () => {
    expect(localizedName(milk, 'he')).toBe('חלב 3%');
    expect(localizedName(dairyCategory, 'he')).toBe('מוצרי חלב');
  });

  it('returns the English name for the en locale', () => {
    expect(localizedName(milk, 'en')).toBe('Milk 3%');
    expect(localizedName(dairyCategory, 'en')).toBe('Dairy');
  });
});

describe('formatCurrency', () => {
  it('formats an ILS amount with two decimals', () => {
    const result = formatCurrency(13.8, 'en');
    expect(result).toContain('13.80');
    expect(result).toMatch(/[₪]|ILS/);
  });

  it('formats for Hebrew too', () => {
    expect(formatCurrency(6.9, 'he')).toContain('6.90');
  });

  it('renders zero rather than an empty string', () => {
    expect(formatCurrency(0, 'en')).toContain('0.00');
  });

  it('returns an em dash for a non-finite amount', () => {
    expect(formatCurrency(Number.NaN, 'en')).toBe('—');
    expect(formatCurrency(Number.POSITIVE_INFINITY, 'he')).toBe('—');
  });

  it('falls back to a plain string when Intl throws', async () => {
    // Re-import the module so its memoised formatter cache is empty and the
    // mocked constructor is actually reached.
    vi.resetModules();
    const spy = vi.spyOn(Intl, 'NumberFormat').mockImplementation(() => {
      throw new Error('no ICU data');
    });

    const fresh = await import('./format');
    expect(fresh.formatCurrency(5, 'he')).toBe('₪5.00');

    spy.mockRestore();
    vi.resetModules();
  });
});

describe('formatDateTime', () => {
  it('formats an ISO timestamp', () => {
    const result = formatDateTime('2026-08-31T09:00:00.000Z', 'en');
    expect(result).toMatch(/2026/);
  });

  it('returns the input unchanged when it is not a date', () => {
    expect(formatDateTime('not-a-date', 'en')).toBe('not-a-date');
  });

  it('falls back to the ISO string when Intl throws', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no ICU data');
    });
    expect(formatDateTime('2026-08-31T09:00:00.000Z', 'he')).toBe('2026-08-31T09:00:00.000Z');
    spy.mockRestore();
  });
});

describe('round2', () => {
  it.each([
    [0.1 + 0.2, 0.3],
    [13.799999999, 13.8],
    [2.345, 2.35],
    [10, 10],
    [0, 0],
  ])('rounds %s to %s', (input, expected) => {
    expect(round2(input)).toBe(expected);
  });
});

describe('UNIT_KEYS', () => {
  it('matches the units the catalog contract defines', () => {
    expect(UNIT_KEYS).toEqual(['unit', 'kg', 'pack', 'bottle', 'carton']);
  });
});
