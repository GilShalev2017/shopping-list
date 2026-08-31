import { describe, expect, it } from 'vitest';
import {
  initialUiState,
  localeChanged,
  localeToggled,
  themeChanged,
  themeToggled,
  uiReducer,
  type ThemeMode,
} from './uiSlice';

describe('uiSlice', () => {
  it('defaults to the system theme and Hebrew', () => {
    expect(uiReducer(undefined, { type: '@@INIT' })).toEqual(initialUiState);
    expect(initialUiState.locale).toBe('he');
    expect(initialUiState.theme).toBe('system');
  });

  it.each<ThemeMode>(['light', 'dark', 'system'])('sets the %s theme explicitly', (mode) => {
    expect(uiReducer(initialUiState, themeChanged(mode)).theme).toBe(mode);
  });

  it('cycles light -> dark -> system -> light', () => {
    let state = uiReducer({ ...initialUiState, theme: 'light' }, themeToggled());
    expect(state.theme).toBe('dark');

    state = uiReducer(state, themeToggled());
    expect(state.theme).toBe('system');

    state = uiReducer(state, themeToggled());
    expect(state.theme).toBe('light');
  });

  it('sets the locale explicitly', () => {
    expect(uiReducer(initialUiState, localeChanged('en')).locale).toBe('en');
    expect(uiReducer(initialUiState, localeChanged('he')).locale).toBe('he');
  });

  it('toggles between the two locales', () => {
    const toEnglish = uiReducer({ ...initialUiState, locale: 'he' }, localeToggled());
    expect(toEnglish.locale).toBe('en');
    expect(uiReducer(toEnglish, localeToggled()).locale).toBe('he');
  });

  it('does not mutate the previous state', () => {
    const before = { ...initialUiState };
    uiReducer(before, themeChanged('dark'));
    expect(before).toEqual(initialUiState);
  });
});
