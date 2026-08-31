import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/renderWithProviders';
import { cottage, milk, uiState } from '@/test/fixtures';
import { ORDERS_BASE_URL } from '@/features/orders/ordersApi';
import { App } from './App';

/**
 * End-to-end journey across both assignment screens, exercising the real store,
 * the real router and the real RTK Query layer against a mocked network.
 */
describe('App — full order journey', () => {
  it('walks from an empty cart to a confirmed order', async () => {
    let posted: { items: unknown[]; customer: { fullName: string } } | undefined;
    server.use(
      http.post(`${ORDERS_BASE_URL}/api/orders`, async ({ request }) => {
        posted = (await request.json()) as typeof posted;
        return HttpResponse.json(
          {
            id: 'ord_journey',
            reference: 'ORD-JOURNEY',
            customer: posted?.customer,
            items: [
              {
                productId: milk.id,
                categoryId: 1,
                nameEn: milk.nameEn,
                nameHe: milk.nameHe,
                unit: milk.unit,
                quantity: 2,
                unitPrice: 6.9,
                lineTotal: 13.8,
              },
              {
                productId: cottage.id,
                categoryId: 1,
                nameEn: cottage.nameEn,
                nameHe: cottage.nameHe,
                unit: cottage.unit,
                quantity: 1,
                unitPrice: 7.4,
                lineTotal: 7.4,
              },
            ],
            itemCount: 3,
            totalAmount: 21.2,
            currency: 'ILS',
            locale: 'en',
            status: 'confirmed',
            createdAt: '2026-08-31T09:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );

    const { user } = renderWithProviders(<App />, {
      preloadedState: { ui: uiState('en') },
    });

    /* --- Screen 1 ------------------------------------------------------ */
    await screen.findByTestId('product-grid');

    // Dropdown flow: category -> product -> quantity -> add.
    await user.selectOptions(screen.getByTestId('product-select'), String(milk.id));
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await user.click(screen.getByTestId('add-to-cart'));

    // Grid flow for the second product.
    await user.click(screen.getByTestId(`product-tile-${cottage.id}`));

    expect(screen.getByTestId('cart-total')).toHaveTextContent('21.20');
    expect(screen.getByTestId('header-cart-count')).toHaveTextContent('3');

    /* --- Screen 2 ------------------------------------------------------ */
    await user.click(screen.getByTestId('continue-to-order'));

    expect(await screen.findByTestId('order-form')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-items')).toHaveTextContent('Milk 3%');
    expect(screen.getByTestId('checkout-items')).toHaveTextContent('Cottage cheese 5%');

    await user.type(screen.getByTestId('input-fullName'), 'Dana Levi');
    await user.type(screen.getByTestId('input-address'), 'Herzl 10, Tel Aviv');
    await user.type(screen.getByTestId('input-email'), 'dana@example.com');
    await user.click(screen.getByTestId('submit-order'));

    /* --- Receipt ------------------------------------------------------- */
    expect(await screen.findByTestId('order-reference')).toHaveTextContent('ORD-JOURNEY');
    expect(screen.getByTestId('confirmation-total')).toHaveTextContent('21.20');

    // The server received both the customer form and the item array (req. 4).
    expect(posted?.items).toHaveLength(2);
    expect(posted?.customer.fullName).toBe('Dana Levi');

    // And the cart was emptied.
    await waitFor(() => expect(screen.getByTestId('header-cart-count')).toHaveTextContent('0'));
  });

  it('switches the entire UI to Hebrew and flips the layout to RTL', async () => {
    const { user } = renderWithProviders(<App />, {
      preloadedState: { ui: uiState('en', 'light') },
    });
    await screen.findByTestId('product-grid');

    expect(document.documentElement).toHaveAttribute('dir', 'ltr');

    await user.click(screen.getByRole('button', { name: /עברית/ }));

    await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'rtl'));
    expect(document.documentElement).toHaveAttribute('lang', 'he');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('רשימת קניות');
    expect(screen.getByTestId('add-to-cart')).toHaveTextContent('הוסף מוצר לסל');
  });

  it('switches between light and dark themes', async () => {
    const { user } = renderWithProviders(<App />, {
      preloadedState: { ui: uiState('en', 'light') },
    });
    await screen.findByTestId('product-grid');

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    await user.click(screen.getByTestId('theme-toggle'));

    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'));
  });

  it('keeps the cart across a navigation to checkout and back', async () => {
    const { user } = renderWithProviders(<App />, {
      preloadedState: { ui: uiState('en') },
    });
    await screen.findByTestId('product-grid');

    await user.click(screen.getByTestId(`product-tile-${milk.id}`));
    await user.click(screen.getByTestId('continue-to-order'));
    await screen.findByTestId('order-form');

    await user.click(screen.getByRole('link', { name: /Back to the shopping list/ }));

    expect(await screen.findByTestId('cart-total')).toHaveTextContent('6.90');
  });

  it('redirects an unknown route to the shopping list', async () => {
    renderWithProviders(<App />, {
      preloadedState: { ui: uiState('en') },
      route: '/nowhere',
    });

    expect(await screen.findByTestId('product-grid')).toBeInTheDocument();
  });
});
