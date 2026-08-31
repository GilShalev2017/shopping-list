import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen } from '@testing-library/react';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/renderWithProviders';
import { orderFixture, uiState } from '@/test/fixtures';
import { ORDERS_BASE_URL } from '@/features/orders/ordersApi';
import { OrderConfirmationPage } from './OrderConfirmationPage';

const renderPage = (
  { id = orderFixture.id, handOver = false, locale = 'en' as 'he' | 'en' } = {},
) =>
  renderWithProviders(<OrderConfirmationPage />, {
    preloadedState: { ui: uiState(locale) },
    route: `/orders/${id}`,
    path: '/orders/:orderId',
    routeState: handOver ? { order: orderFixture } : undefined,
  });

describe('OrderConfirmationPage', () => {
  it('renders instantly from the order handed over by the checkout page', () => {
    let called = false;
    server.use(
      http.get(`${ORDERS_BASE_URL}/api/orders/:id`, () => {
        called = true;
        return HttpResponse.json(orderFixture);
      }),
    );

    renderPage({ handOver: true });

    expect(screen.getByTestId('order-reference')).toHaveTextContent(orderFixture.reference);
    expect(called).toBe(false);
  });

  it('fetches the order by id when opened cold', async () => {
    renderPage();

    expect(await screen.findByTestId('order-reference')).toHaveTextContent(
      orderFixture.reference,
    );
  });

  it('shows a skeleton while the order loads', () => {
    renderPage();
    expect(screen.getByText('Loading your order…')).toBeInTheDocument();
  });

  it('shows the customer details and the ordered items', async () => {
    renderPage({ handOver: true });

    expect(screen.getByText(/Thank you, Dana Levi/)).toBeInTheDocument();
    expect(screen.getByText('Herzl 10, Tel Aviv')).toBeInTheDocument();
    expect(screen.getByText(/dana@example.com/)).toBeInTheDocument();
    expect(screen.getByTestId('confirmation-items')).toHaveTextContent('Milk 3%');
    expect(screen.getByTestId('confirmation-total')).toHaveTextContent('13.80');
  });

  it('shows a not-found state for an unknown order', async () => {
    renderPage({ id: 'missing' });

    expect(await screen.findByText('We could not find that order.')).toBeInTheDocument();
    expect(
      screen.getByText('The reference may be wrong, or the order service may be unavailable.'),
    ).toBeInTheDocument();
  });

  it('offers a way back to the shopping list when the order is missing', async () => {
    renderPage({ id: 'missing' });
    expect(
      await screen.findByRole('button', { name: 'Go to the shopping list' }),
    ).toBeInTheDocument();
  });

  it('renders the Hebrew name for each item when the locale is Hebrew', () => {
    renderPage({ handOver: true, locale: 'he' });

    expect(screen.getByTestId('confirmation-items')).toHaveTextContent('חלב 3%');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ההזמנה אושרה');
  });

  it('offers starting a new order', () => {
    renderPage({ handOver: true });
    expect(screen.getByRole('button', { name: 'Start a new order' })).toBeInTheDocument();
  });
});
