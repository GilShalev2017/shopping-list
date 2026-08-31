import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { uiState } from '@/test/fixtures';
import { AppearanceControls, LanguageToggle, ThemeToggle } from './AppearanceControls';
import { useAppearance } from './useAppearance';

/**
 * `useAppearance` is what pushes the store's locale into i18next in the real
 * app (App.tsx calls it once). Tests that assert live language switching mount
 * it alongside the controls so the wiring under test is the production wiring.
 */
const WithAppearance = () => {
  useAppearance();
  return <AppearanceControls />;
};

describe('ThemeToggle', () => {
  it('shows the current mode', () => {
    renderWithProviders(<ThemeToggle />, { preloadedState: { ui: uiState('en', 'light') } });
    expect(screen.getByTestId('theme-toggle')).toHaveTextContent('Light');
  });

  it('cycles light -> dark -> system on click', async () => {
    const { user, store } = renderWithProviders(<ThemeToggle />, {
      preloadedState: { ui: uiState('en', 'light') },
    });
    const toggle = screen.getByTestId('theme-toggle');

    await user.click(toggle);
    expect(store.getState().ui.theme).toBe('dark');
    expect(toggle).toHaveTextContent('Dark');

    await user.click(toggle);
    expect(store.getState().ui.theme).toBe('system');
    expect(toggle).toHaveTextContent('System');

    await user.click(toggle);
    expect(store.getState().ui.theme).toBe('light');
  });

  it('exposes the mode in its accessible name', () => {
    renderWithProviders(<ThemeToggle />, { preloadedState: { ui: uiState('en', 'dark') } });
    expect(
      screen.getByRole('button', { name: /Switch theme \(currently: Dark\)/ }),
    ).toBeInTheDocument();
  });

  it('is labelled in Hebrew when the locale is Hebrew', () => {
    renderWithProviders(<ThemeToggle />, { preloadedState: { ui: uiState('he', 'light') } });
    expect(screen.getByTestId('theme-toggle')).toHaveTextContent('בהיר');
  });
});

describe('LanguageToggle', () => {
  it('marks the active locale with aria-pressed', () => {
    renderWithProviders(<LanguageToggle />, { preloadedState: { ui: uiState('en') } });

    expect(screen.getByRole('button', { name: /English/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /עברית/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('switches the store locale and re-renders the UI in the new language', async () => {
    const { user, store } = renderWithProviders(<WithAppearance />, {
      preloadedState: { ui: uiState('en', 'light') },
    });

    await user.click(screen.getByRole('button', { name: /עברית/ }));

    expect(store.getState().ui.locale).toBe('he');
    // The theme toggle text is now Hebrew, proving i18next followed the store.
    expect(await screen.findByText('בהיר')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('clicking the already-active locale keeps it selected', async () => {
    const { user, store } = renderWithProviders(<LanguageToggle />, {
      preloadedState: { ui: uiState('en') },
    });

    await user.click(screen.getByRole('button', { name: /English/ }));
    expect(store.getState().ui.locale).toBe('en');
  });

  it('renders both controls together', () => {
    renderWithProviders(<AppearanceControls />, { preloadedState: { ui: uiState('en') } });
    expect(screen.getByTestId('language-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });
});
