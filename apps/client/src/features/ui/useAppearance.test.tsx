import { describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { uiState } from '@/test/fixtures';
import { DARK_MEDIA_QUERY, resolveTheme, useAppearance } from './useAppearance';
import { localeChanged, themeChanged } from './uiSlice';

const Probe = () => {
  useAppearance();
  return <span data-testid="probe">ok</span>;
};

/** Replaces window.matchMedia with a controllable stub. */
const mockMatchMedia = (matches: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: DARK_MEDIA_QUERY,
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
    ),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  });

  return {
    mql,
    /** Simulates the OS flipping to the other colour scheme. */
    emit(nextMatches: boolean) {
      mql.matches = nextMatches;
      listeners.forEach((listener) => listener({ matches: nextMatches } as MediaQueryListEvent));
    },
  };
};

describe('resolveTheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('resolves %s with prefersDark=%s to %s', (mode, prefersDark, expected) => {
    expect(resolveTheme(mode, prefersDark)).toBe(expected);
  });
});

describe('useAppearance', () => {
  it('writes an explicit light theme to the document', () => {
    mockMatchMedia(true);
    renderWithProviders(<Probe />, { preloadedState: { ui: uiState('en', 'light') } });
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('writes an explicit dark theme to the document', () => {
    mockMatchMedia(false);
    renderWithProviders(<Probe />, { preloadedState: { ui: uiState('en', 'dark') } });
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('follows the OS preference in system mode', () => {
    mockMatchMedia(true);
    renderWithProviders(<Probe />, { preloadedState: { ui: uiState('en', 'system') } });
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('reacts to the OS preference changing while in system mode', () => {
    const media = mockMatchMedia(false);
    renderWithProviders(<Probe />, { preloadedState: { ui: uiState('en', 'system') } });
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    act(() => media.emit(true));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('does not subscribe to the media query when the theme is explicit', () => {
    const media = mockMatchMedia(false);
    renderWithProviders(<Probe />, { preloadedState: { ui: uiState('en', 'dark') } });
    expect(media.mql.addEventListener).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const media = mockMatchMedia(false);
    const { unmount } = renderWithProviders(<Probe />, {
      preloadedState: { ui: uiState('en', 'system') },
    });

    expect(media.mql.addEventListener).toHaveBeenCalled();
    unmount();
    expect(media.mql.removeEventListener).toHaveBeenCalled();
  });

  it('sets dir=rtl and lang=he for Hebrew', () => {
    mockMatchMedia(false);
    renderWithProviders(<Probe />, { preloadedState: { ui: uiState('he') } });

    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('lang', 'he');
  });

  it('sets dir=ltr and lang=en for English', () => {
    mockMatchMedia(false);
    renderWithProviders(<Probe />, { preloadedState: { ui: uiState('en') } });

    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
  });

  it('re-applies direction and theme when the store changes', () => {
    mockMatchMedia(false);
    const { store } = renderWithProviders(<Probe />, {
      preloadedState: { ui: uiState('en', 'light') },
    });
    expect(screen.getByTestId('probe')).toBeInTheDocument();

    act(() => {
      store.dispatch(localeChanged('he'));
      store.dispatch(themeChanged('dark'));
    });

    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('degrades gracefully when matchMedia is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: undefined,
    });

    expect(() =>
      renderWithProviders(<Probe />, { preloadedState: { ui: uiState('en', 'system') } }),
    ).not.toThrow();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
});
