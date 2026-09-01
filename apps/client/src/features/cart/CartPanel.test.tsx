import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { banana, cottage, makeCartItem, makeCartState, milk, uiState } from '@/test/fixtures';
import { mockTruncation } from '@/test/truncation';
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

describe('CartPanel — tooltip for clipped product names', () => {
  const longName = 'Organic semi-skimmed milk 3% in a one litre carton';

  const renderWithName = () =>
    renderWithProviders(<CartPanel />, {
      preloadedState: {
        cart: makeCartState([makeCartItem({ nameEn: longName, quantity: 1 })]),
        ui: uiState('en'),
      },
    });

  it('offers the full name on hover when the label is clipped', async () => {
    mockTruncation(true);
    const { user } = renderWithName();

    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();

    await user.hover(screen.getByTestId(`cart-line-label-${milk.id}`));

    expect(screen.getByTestId('tooltip')).toHaveTextContent(longName);
  });

  it('hides the tooltip again when the pointer leaves', async () => {
    mockTruncation(true);
    const { user } = renderWithName();
    const label = screen.getByTestId(`cart-line-label-${milk.id}`);

    await user.hover(label);
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();

    await user.unhover(label);
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('shows the tooltip when the emoji is hovered, not just the text', async () => {
    mockTruncation(true);
    const { user } = renderWithName();

    const emoji = screen.getByTestId(`cart-line-${milk.id}`).querySelector('[aria-hidden="true"]');
    await user.hover(emoji as HTMLElement);

    expect(screen.getByTestId('tooltip')).toHaveTextContent(longName);
  });

  it('does not offer a tooltip when the name fits', async () => {
    mockTruncation(false);
    const { user } = renderWithProviders(<CartPanel />, {
      preloadedState: {
        cart: makeCartState([makeCartItem({ quantity: 1 })]),
        ui: uiState('en'),
      },
    });

    // With no tooltip the trigger wrapper is not even rendered with its testid.
    expect(screen.queryByTestId(`cart-line-label-${milk.id}`)).not.toBeInTheDocument();

    await user.hover(screen.getByText('Milk 3%'));
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('shows the Hebrew name in the tooltip when the locale is Hebrew', async () => {
    mockTruncation(true);
    const { user } = renderWithProviders(<CartPanel />, {
      preloadedState: {
        cart: makeCartState([makeCartItem({ quantity: 1 })]),
        ui: uiState('he'),
      },
    });

    await user.hover(screen.getByTestId(`cart-line-label-${milk.id}`));
    expect(screen.getByTestId('tooltip')).toHaveTextContent('חלב 3%');
  });

  it('keeps the row controls working while a tooltip is open', async () => {
    mockTruncation(true);
    const { user, store } = renderWithName();

    await user.hover(screen.getByTestId(`cart-line-label-${milk.id}`));
    await user.click(screen.getByTestId(`cart-remove-${milk.id}`));

    expect(store.getState().cart.ids).toEqual([]);
  });
});
