import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/app/hooks';
import { LOCALE_DIRECTION } from '@/i18n';
import type { ThemeMode } from './uiSlice';

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/** Resolves the tri-state theme preference into the concrete palette to paint. */
export const resolveTheme = (mode: ThemeMode, prefersDark: boolean): 'light' | 'dark' => {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
};

const matchesDark = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
};

/**
 * The single place where Redux UI state is reflected onto the document:
 *
 *  - `data-theme` drives the CSS custom-property palette
 *  - `dir` flips the whole layout, which works because every rule in the
 *    stylesheet uses logical properties (inline-start/end, not left/right)
 *  - `lang` is what screen readers and the font stack key off
 *
 * Keeping this in one hook means no component ever touches the DOM directly.
 */
export const useAppearance = (): void => {
  const theme = useAppSelector((state) => state.ui.theme);
  const locale = useAppSelector((state) => state.ui.locale);
  const { i18n } = useTranslation();

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      root.setAttribute('data-theme', resolveTheme(theme, matchesDark()));
    };

    apply();

    if (theme !== 'system') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const media = window.matchMedia(DARK_MEDIA_QUERY);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', locale);
    root.setAttribute('dir', LOCALE_DIRECTION[locale]);

    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);
};
