import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { makeCartItem, makeCartState, uiState } from '@/test/fixtures';
import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  it('renders its children inside the main landmark', () => {
    renderWithProviders(
      <AppLayout>
        <p>Page body</p>
      </AppLayout>,
      { preloadedState: { ui: uiState('en') } },
    );

    expect(screen.getByRole('main')).toHaveTextContent('Page body');
  });

  it('renders the banner, main and contentinfo landmarks', () => {
    renderWithProviders(<AppLayout>body</AppLayout>, {
      preloadedState: { ui: uiState('en') },
    });

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('provides a skip link that targets the main region', () => {
    renderWithProviders(<AppLayout>body</AppLayout>, {
      preloadedState: { ui: uiState('en') },
    });

    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('shows a zero cart badge when the cart is empty', () => {
    renderWithProviders(<AppLayout>body</AppLayout>, {
      preloadedState: { ui: uiState('en') },
    });

    expect(screen.getByTestId('header-cart-count')).toHaveTextContent('0');
  });

  it('shows the summed quantity, not the line count', () => {
    renderWithProviders(<AppLayout>body</AppLayout>, {
      preloadedState: {
        ui: uiState('en'),
        cart: makeCartState([
          makeCartItem({ quantity: 2 }),
          makeCartItem({ productId: 999, quantity: 5 }),
        ]),
      },
    });

    expect(screen.getByTestId('header-cart-count')).toHaveTextContent('7');
  });

  it('links the brand home and the cart pill to the checkout', () => {
    renderWithProviders(<AppLayout>body</AppLayout>, {
      preloadedState: { ui: uiState('en') },
    });

    expect(screen.getByTestId('header-cart')).toHaveAttribute('href', '/checkout');
    expect(screen.getByRole('link', { name: /Shopping List/ })).toHaveAttribute('href', '/');
  });

  it('exposes the appearance controls in the header', () => {
    renderWithProviders(<AppLayout>body</AppLayout>, {
      preloadedState: { ui: uiState('en') },
    });

    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('language-toggle')).toBeInTheDocument();
  });

  it('renders the header in Hebrew for the Hebrew locale', () => {
    renderWithProviders(<AppLayout>body</AppLayout>, {
      preloadedState: { ui: uiState('he') },
    });

    expect(screen.getByTestId('header-cart')).toHaveTextContent('הסל שלך');
  });
});
