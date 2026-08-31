import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/renderWithProviders';
import { cottage, makeCartItem, makeCartState, milk, uiState } from '@/test/fixtures';
import { ORDERS_BASE_URL } from '@/features/orders/ordersApi';
import { CheckoutPage } from './CheckoutPage';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useNavigate: () => navigate };
});

const filledCart = makeCartState([
  makeCartItem({ quantity: 2, unitPrice: 6.9 }),
  makeCartItem({
    productId: cottage.id,
    nameEn: cottage.nameEn,
    nameHe: cottage.nameHe,
    emoji: cottage.emoji,
    unit: cottage.unit,
    unitPrice: 7.4,
    quantity: 1,
  }),
]);

const renderPage = (locale: 'he' | 'en' = 'en', cart = filledCart) =>
  renderWithProviders(<CheckoutPage />, {
    preloadedState: { cart, ui: uiState(locale) },
    route: '/checkout',
  });

const fillValidForm = async (user: ReturnType<typeof renderPage>['user']) => {
  await user.type(screen.getByTestId('input-fullName'), 'Dana Levi');
  await user.type(screen.getByTestId('input-address'), 'Herzl 10, Tel Aviv');
  await user.type(screen.getByTestId('input-email'), 'dana@example.com');
};

describe('CheckoutPage', () => {
  it('redirects the user back when the cart is empty', () => {
    renderWithProviders(<CheckoutPage />, { preloadedState: { ui: uiState('en') } });

    expect(screen.getByText('There is nothing to order yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('order-form')).not.toBeInTheDocument();
  });

  it('renders the three required fields (assignment requirement 1)', () => {
    renderPage();

    expect(screen.getByLabelText(/First and last name/)).toBeRequired();
    expect(screen.getByLabelText(/Full address/)).toBeRequired();
    expect(screen.getByLabelText(/Email/)).toBeRequired();
  });

  it('lists the products chosen on screen 1 (assignment requirement 2)', () => {
    renderPage();

    const list = screen.getByTestId('checkout-items');
    expect(list).toHaveTextContent('Milk 3%');
    expect(list).toHaveTextContent('Cottage cheese 5%');
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('21.20');
  });

  it('blocks submission and reports every empty required field', async () => {
    const { user } = renderPage();

    await user.click(screen.getByTestId('submit-order'));

    expect(screen.getByTestId('validation-summary')).toHaveTextContent('3 fields need attention');
    expect(screen.getByText('Please enter your first and last name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your full address.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your email address.')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('rejects a one-word name and an invalid email', async () => {
    const { user } = renderPage();

    await user.type(screen.getByTestId('input-fullName'), 'Dana');
    await user.type(screen.getByTestId('input-address'), 'Herzl 10, Tel Aviv');
    await user.type(screen.getByTestId('input-email'), 'not-an-email');
    await user.click(screen.getByTestId('submit-order'));

    expect(screen.getByText('Please enter both a first and a last name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
  });

  it('stays quiet until the first submit attempt', async () => {
    const { user } = renderPage();

    await user.type(screen.getByTestId('input-fullName'), 'D');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('re-validates live once the user has submitted', async () => {
    const { user } = renderPage();

    await user.click(screen.getByTestId('submit-order'));
    expect(screen.getByText('Please enter your first and last name.')).toBeInTheDocument();

    await user.type(screen.getByTestId('input-fullName'), 'Dana Levi');
    await waitFor(() =>
      expect(
        screen.queryByText('Please enter your first and last name.'),
      ).not.toBeInTheDocument(),
    );
  });

  it('marks invalid fields with aria-invalid for assistive tech', async () => {
    const { user } = renderPage();
    await user.click(screen.getByTestId('submit-order'));

    expect(screen.getByTestId('input-email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sends the form plus the item array and navigates to the receipt', async () => {
    let body: unknown;
    server.use(
      http.post(`${ORDERS_BASE_URL}/api/orders`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            id: 'ord_1',
            reference: 'ORD-AAA111',
            customer: (body as { customer: unknown }).customer,
            items: [],
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

    const { user } = renderPage();
    await fillValidForm(user);
    await user.click(screen.getByTestId('submit-order'));

    await waitFor(() => expect(navigate).toHaveBeenCalled());

    expect(body).toMatchObject({
      customer: {
        fullName: 'Dana Levi',
        address: 'Herzl 10, Tel Aviv',
        email: 'dana@example.com',
      },
      locale: 'en',
    });
    expect((body as { items: unknown[] }).items).toHaveLength(2);
    expect((body as { items: { productId: number }[] }).items[0]?.productId).toBe(milk.id);
    expect(navigate).toHaveBeenCalledWith('/orders/ord_1', expect.anything());
  });

  it('normalises the customer before sending', async () => {
    let body: { customer: { fullName: string; email: string } } | undefined;
    server.use(
      http.post(`${ORDERS_BASE_URL}/api/orders`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ id: 'x' }, { status: 201 });
      }),
    );

    const { user } = renderPage();
    await user.type(screen.getByTestId('input-fullName'), '  Dana   Levi ');
    await user.type(screen.getByTestId('input-address'), 'Herzl 10, Tel Aviv');
    await user.type(screen.getByTestId('input-email'), 'DANA@Example.COM');
    await user.click(screen.getByTestId('submit-order'));

    await waitFor(() => expect(body).toBeDefined());
    expect(body?.customer.fullName).toBe('Dana Levi');
    expect(body?.customer.email).toBe('dana@example.com');
  });

  it('empties the cart after a successful order', async () => {
    const { user, store } = renderPage();
    await fillValidForm(user);
    await user.click(screen.getByTestId('submit-order'));

    await waitFor(() => expect(store.getState().cart.ids).toEqual([]));
  });

  it('shows an error and keeps the cart when the order service fails', async () => {
    server.use(
      http.post(`${ORDERS_BASE_URL}/api/orders`, () =>
        HttpResponse.json({ statusCode: 500 }, { status: 500 }),
      ),
    );

    const { user, store } = renderPage();
    await fillValidForm(user);
    await user.click(screen.getByTestId('submit-order'));

    expect(await screen.findByTestId('submit-error')).toHaveTextContent(
      'The order could not be sent.',
    );
    expect(store.getState().cart.ids).toHaveLength(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('disables the submit button while the request is in flight', async () => {
    server.use(
      http.post(`${ORDERS_BASE_URL}/api/orders`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ id: 'ord_1' }, { status: 201 });
      }),
    );

    const { user } = renderPage();
    await fillValidForm(user);
    await user.click(screen.getByTestId('submit-order'));

    expect(screen.getByTestId('submit-order')).toBeDisabled();
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('sends the active locale with the order', async () => {
    let body: { locale?: string } | undefined;
    server.use(
      http.post(`${ORDERS_BASE_URL}/api/orders`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ id: 'ord_1' }, { status: 201 });
      }),
    );

    const { user } = renderPage('he');
    await user.type(screen.getByTestId('input-fullName'), 'ישראל ישראלי');
    await user.type(screen.getByTestId('input-address'), 'הרצל 10, תל אביב');
    await user.type(screen.getByTestId('input-email'), 'israel@example.com');
    await user.click(screen.getByTestId('submit-order'));

    await waitFor(() => expect(body).toBeDefined());
    expect(body?.locale).toBe('he');
  });

  it('renders in Hebrew for the Hebrew locale', () => {
    renderPage('he');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('סיכום ההזמנה');
    expect(screen.getByTestId('submit-order')).toHaveTextContent('אשר הזמנה');
  });
});
