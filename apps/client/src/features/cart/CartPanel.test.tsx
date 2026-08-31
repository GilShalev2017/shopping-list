import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { banana, cottage, makeCartItem, makeCartState, milk, uiState } from '@/test/fixtures';
import { CartPanel } from './CartPanel';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useNavigate: () => navigate };
});

const twoLines = makeCartState([
  makeCartItem({ quantity: 2, unitPrice: 6.9 }),
  makeCartItem({
    productId: cottage.id,
    nameEn: cottage.nameEn,
    nameHe: cottage.nameHe,
    emoji: cottage.emoji,
    unit: cottage.unit,
    unitPrice: 7.4,
    quantity: 3,
  }),
]);

describe('CartPanel', () => {
  it('shows an empty state when there is nothing in the cart', () => {
    renderWithProviders(<CartPanel />, { preloadedState: { ui: uiState('en') } });

    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
    expect(screen.queryByTestId('cart-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('continue-to-order')).not.toBeInTheDocument();
  });

  it('renders one row per line with its name, unit price and line total', () => {
    renderWithProviders(<CartPanel />, {
      preloadedState: { cart: twoLines, ui: uiState('en') },
    });

    const line = screen.getByTestId(`cart-line-${milk.id}`);
    expect(line).toHaveTextContent('Milk 3%');
    expect(line).toHaveTextContent('6.90');
    expect(screen.getByTestId(`cart-line-total-${milk.id}`)).toHaveTextContent('13.80');
    expect(screen.getByTestId(`cart-line-total-${cottage.id}`)).toHaveTextContent('22.20');
  });

  it('shows the cart total and the line count', () => {
    renderWithProviders(<CartPanel />, {
      preloadedState: { cart: twoLines, ui: uiState('en') },
    });

    expect(screen.getByTestId('cart-total')).toHaveTextContent('36.00');
    expect(screen.getByText('2 lines')).toBeInTheDocument();
  });

  it('updates a line quantity through the stepper', async () => {
    const { user, store } = renderWithProviders(<CartPanel />, {
      preloadedState: { cart: twoLines, ui: uiState('en') },
    });

    const line = screen.getByTestId(`cart-line-${milk.id}`);
    await user.click(within(line).getByRole('button', { name: 'Increase quantity' }));

    expect(store.getState().cart.items[milk.id]?.quantity).toBe(3);
    expect(screen.getByTestId(`cart-line-total-${milk.id}`)).toHaveTextContent('20.70');
  });

  it('removes a line', async () => {
    const { user, store } = renderWithProviders(<CartPanel />, {
      preloadedState: { cart: twoLines, ui: uiState('en') },
    });

    await user.click(screen.getByTestId(`cart-remove-${milk.id}`));

    expect(store.getState().cart.ids).toEqual([cottage.id]);
    expect(screen.queryByTestId(`cart-line-${milk.id}`)).not.toBeInTheDocument();
  });

  it('clears the whole cart', async () => {
    const { user, store } = renderWithProviders(<CartPanel />, {
      preloadedState: { cart: twoLines, ui: uiState('en') },
    });

    await user.click(screen.getByTestId('clear-cart'));

    expect(store.getState().cart.ids).toEqual([]);
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
  });

  it('navigates to the checkout screen', async () => {
    const { user } = renderWithProviders(<CartPanel />, {
      preloadedState: { cart: twoLines, ui: uiState('en') },
    });

    await user.click(screen.getByTestId('continue-to-order'));
    expect(navigate).toHaveBeenCalledWith('/checkout');
  });

  it('gives the remove button an accessible name that names the product', () => {
    renderWithProviders(<CartPanel />, {
      preloadedState: { cart: twoLines, ui: uiState('en') },
    });
    expect(screen.getByTestId(`cart-remove-${milk.id}`)).toHaveAccessibleName(
      'Remove Milk 3%',
    );
  });

  it('clears the highlight after the flash animation', async () => {
    const cart = { ...makeCartState([makeCartItem()]), lastAddedId: milk.id };
    const { store } = renderWithProviders(<CartPanel />, {
      preloadedState: { cart, ui: uiState('en') },
    });

    expect(store.getState().cart.lastAddedId).toBe(milk.id);
    await waitFor(() => expect(store.getState().cart.lastAddedId).toBeNull(), {
      timeout: 2_000,
    });
  });

  it('renders Hebrew content for the Hebrew locale', () => {
    renderWithProviders(<CartPanel />, {
      preloadedState: {
        cart: makeCartState([
          makeCartItem({
            productId: banana.id,
            nameEn: banana.nameEn,
            nameHe: banana.nameHe,
            emoji: banana.emoji,
            unit: banana.unit,
            unitPrice: banana.pricePerUnit,
            quantity: 1,
          }),
        ]),
        ui: uiState('he'),
      },
    });

    expect(screen.getByTestId(`cart-line-${banana.id}`)).toHaveTextContent('בננות');
    expect(screen.getByTestId('continue-to-order')).toHaveTextContent('המשך הזמנה');
  });
});
