import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { SUPPORTED_LOCALES } from '@/i18n';
import { localeChanged, themeToggled, type Locale, type ThemeMode } from './uiSlice';
import styles from './AppearanceControls.module.css';

const THEME_GLYPH: Record<ThemeMode, string> = {
  light: '☀️',
  dark: '🌙',
  system: '🖥️',
};

/** Cycles light → dark → system. The current mode is announced, not just drawn. */
export const ThemeToggle = () => {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.ui.theme);
  const { t } = useTranslation();

  const modeLabel = t(`theme.${theme}`);

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => dispatch(themeToggled())}
      aria-label={t('theme.switchTo', { mode: modeLabel })}
      title={t('theme.switchTo', { mode: modeLabel })}
      data-testid="theme-toggle"
      data-theme-mode={theme}
    >
      <span className={styles.glyph} aria-hidden="true">
        {THEME_GLYPH[theme]}
      </span>
      <span>{modeLabel}</span>
    </button>
  );
};

/**
 * Explicit two-option segmented control rather than a toggle: with only two
 * languages, showing both and marking the active one is clearer and gives
 * screen-reader users a proper `aria-pressed` state per option.
 */
export const LanguageToggle = () => {
  const dispatch = useAppDispatch();
  const locale = useAppSelector((state) => state.ui.locale);
  const { t } = useTranslation();

  return (
    <div
      className={styles.segmented}
      role="group"
      aria-label={t('language.label')}
      data-testid="language-toggle"
    >
      {SUPPORTED_LOCALES.map((code: Locale) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            className={[styles.segment, active ? styles.segmentActive : undefined]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={active}
            aria-label={t('language.switchTo', { language: t(`language.${code}`) })}
            onClick={() => dispatch(localeChanged(code))}
          >
            {t(`language.${code}`)}
          </button>
        );
      })}
    </div>
  );
};

export const AppearanceControls = () => (
  <div className={styles.controls}>
    <LanguageToggle />
    <ThemeToggle />
  </div>
);

export default AppearanceControls;
