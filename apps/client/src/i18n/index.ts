import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import he from './locales/he.json';
import type { Locale } from '@/features/ui/uiSlice';

export const SUPPORTED_LOCALES = ['he', 'en'] as const;

export const LOCALE_DIRECTION: Record<Locale, 'rtl' | 'ltr'> = {
  he: 'rtl',
  en: 'ltr',
};

export const resources = {
  en: { translation: en },
  he: { translation: he },
} as const;

/**
 * i18next is initialised synchronously with both bundles inlined. There is no
 * HTTP backend and no language detector plugin: the active language is owned by
 * the Redux `ui` slice (so it is persisted with the rest of the UI state) and
 * pushed into i18next by the `useLocaleDirection` hook.
 */
export const initI18n = (locale: Locale = 'he') => {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: locale,
      fallbackLng: 'en',
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      interpolation: { escapeValue: false },
      returnNull: false,
      react: { useSuspense: false },
    });
  }
  return i18n;
};

export const isLocale = (value: unknown): value is Locale =>
  value === 'he' || value === 'en';

export default i18n;
