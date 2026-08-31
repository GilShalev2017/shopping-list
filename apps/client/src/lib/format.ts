import type { Category, Product, ProductUnit } from '@/types/catalog';
import type { Locale } from '@/features/ui/uiSlice';

/** Picks the Hebrew or English name off any bilingual record. */
export const localizedName = (
  entity: Pick<Product | Category, 'nameEn' | 'nameHe'>,
  locale: Locale,
): string => (locale === 'he' ? entity.nameHe : entity.nameEn);

const currencyFormatters = new Map<string, Intl.NumberFormat>();

const getCurrencyFormatter = (locale: Locale): Intl.NumberFormat => {
  const tag = locale === 'he' ? 'he-IL' : 'en-IL';
  let formatter = currencyFormatters.get(tag);
  if (!formatter) {
    formatter = new Intl.NumberFormat(tag, {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(tag, formatter);
  }
  return formatter;
};

/** Formats an ILS amount, falling back to a plain string if Intl misbehaves. */
export const formatCurrency = (amount: number, locale: Locale): string => {
  if (!Number.isFinite(amount)) return '—';
  try {
    return getCurrencyFormatter(locale).format(amount);
  } catch {
    return `₪${amount.toFixed(2)}`;
  }
};

export const formatDateTime = (iso: string, locale: Locale): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toISOString();
  }
};

export const UNIT_KEYS: ProductUnit[] = ['unit', 'kg', 'pack', 'bottle', 'carton'];

/** Rounds to 2 decimals without float drift (0.1 + 0.2 style errors). */
export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
