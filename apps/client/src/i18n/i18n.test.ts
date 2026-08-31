import { describe, expect, it } from 'vitest';
import { LOCALE_DIRECTION, SUPPORTED_LOCALES, initI18n, isLocale, resources } from './index';
import en from './locales/en.json';
import he from './locales/he.json';

/** Flattens a nested translation bundle into dotted key paths. */
const flatten = (value: unknown, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
};

/** Plural suffixes differ per language, so compare on the base key. */
const baseKey = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');

const enKeys = new Set(flatten(en).map(baseKey));
const heKeys = new Set(flatten(he).map(baseKey));

describe('translation bundles', () => {
  it('exposes exactly the two supported locales', () => {
    expect(SUPPORTED_LOCALES).toEqual(['he', 'en']);
    expect(Object.keys(resources).sort()).toEqual(['en', 'he']);
  });

  it('has no key present in English but missing in Hebrew', () => {
    const missing = [...enKeys].filter((key) => !heKeys.has(key));
    expect(missing).toEqual([]);
  });

  it('has no key present in Hebrew but missing in English', () => {
    const missing = [...heKeys].filter((key) => !enKeys.has(key));
    expect(missing).toEqual([]);
  });

  it('has no empty translation strings', () => {
    for (const [locale, bundle] of Object.entries({ en, he })) {
      const empties = flatten(bundle).filter((path) => {
        const value = path
          .split('.')
          .reduce<unknown>(
            (node, key) => (node as Record<string, unknown> | undefined)?.[key],
            bundle,
          );
        return typeof value === 'string' && value.trim() === '';
      });
      expect(empties, `${locale} has empty strings`).toEqual([]);
    }
  });

  it('keeps interpolation placeholders identical across locales', () => {
    const placeholders = (value: unknown): string[] =>
      typeof value === 'string' ? (value.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort() : [];

    const read = (bundle: unknown, path: string) =>
      path
        .split('.')
        .reduce<unknown>(
          (node, key) => (node as Record<string, unknown> | undefined)?.[key],
          bundle,
        );

    for (const path of flatten(en)) {
      const enValue = read(en, path);
      const heValue = read(he, baseKey(path)) ?? read(he, path);
      if (typeof enValue !== 'string' || typeof heValue !== 'string') continue;
      // Plural variants legitimately drop the count placeholder ("one item").
      if (/_(one|two|few|many)$/.test(path)) continue;
      expect(placeholders(heValue), `placeholders differ at ${path}`).toEqual(
        placeholders(enValue),
      );
    }
  });
});

describe('i18n runtime', () => {
  it('initialises once and is idempotent', () => {
    const first = initI18n('en');
    const second = initI18n('he');
    expect(first).toBe(second);
    expect(first.isInitialized).toBe(true);
  });

  it('resolves keys in both languages', async () => {
    const i18n = initI18n('en');

    await i18n.changeLanguage('en');
    expect(i18n.t('checkout.submit')).toBe('Confirm order');

    await i18n.changeLanguage('he');
    expect(i18n.t('checkout.submit')).toBe('אשר הזמנה');
  });

  it('pluralises the item count correctly in both languages', async () => {
    const i18n = initI18n('en');

    await i18n.changeLanguage('en');
    expect(i18n.t('cart.items', { count: 1 })).toBe('1 item');
    expect(i18n.t('cart.items', { count: 4 })).toBe('4 items');

    await i18n.changeLanguage('he');
    expect(i18n.t('cart.items', { count: 1 })).toBe('פריט אחד');
    expect(i18n.t('cart.items', { count: 4 })).toContain('4');
  });

  it('interpolates variables', async () => {
    const i18n = initI18n('en');
    await i18n.changeLanguage('en');
    expect(i18n.t('confirmation.thanks', { name: 'Dana' })).toBe('Thank you, Dana!');
  });

  it('maps each locale to a writing direction', () => {
    expect(LOCALE_DIRECTION).toEqual({ he: 'rtl', en: 'ltr' });
  });

  it('recognises supported locales only', () => {
    expect(isLocale('he')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
