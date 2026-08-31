import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Locale = 'he' | 'en';

export interface UiState {
  theme: ThemeMode;
  locale: Locale;
}

export const DEFAULT_LOCALE: Locale =
  (import.meta.env?.VITE_DEFAULT_LOCALE as Locale | undefined) ?? 'he';

export const initialUiState: UiState = {
  theme: 'system',
  locale: DEFAULT_LOCALE,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUiState,
  reducers: {
    themeChanged(state, action: PayloadAction<ThemeMode>) {
      state.theme = action.payload;
    },
    /** Cycles light -> dark -> system -> light, used by the header toggle. */
    themeToggled(state) {
      state.theme =
        state.theme === 'light' ? 'dark' : state.theme === 'dark' ? 'system' : 'light';
    },
    localeChanged(state, action: PayloadAction<Locale>) {
      state.locale = action.payload;
    },
    localeToggled(state) {
      state.locale = state.locale === 'he' ? 'en' : 'he';
    },
  },
});

export const { themeChanged, themeToggled, localeChanged, localeToggled } = uiSlice.actions;

export const uiReducer = uiSlice.reducer;
export default uiSlice.reducer;
