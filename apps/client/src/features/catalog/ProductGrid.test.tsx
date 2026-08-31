import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { categories, dairyCategory, emptyCategory, milk, uiState } from '@/test/fixtures';
import { ProductGrid } from './ProductGrid';

const setup = (selectedCategoryId: number | null, locale: 'he' | 'en' = 'en') => {
  const onCategoryChange = vi.fn();
  const utils = renderWithProviders(
    <ProductGrid
      categories={categories}
      selectedCategoryId={selectedCategoryId}
      onCategoryChange={onCategoryChange}
    />,
    { preloadedState: { ui: uiState(locale) } },
  );
  return { onCategoryChange, ...utils };
};

describe('ProductGrid', () => {
  it('renders a chip per category with its product count', () => {
    setup(null);
    const chip = screen.getByTestId(`category-chip-${dairyCategory.id}`);
    expect(chip).toHaveTextContent('Dairy');
    expect(chip).toHaveTextContent('2');
  });

  it('marks the selected chip as pressed', () => {
    setup(dairyCategory.id);
    expect(screen.getByTestId(`category-chip-${dairyCategory.id}`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('category-chip-2')).toHaveAttribute('aria-pressed', 'false');
  });

  it('prompts the user to pick a category when none is selected', () => {
    setup(null);
    expect(screen.getByText('Choose a category above to see its products.')).toBeInTheDocument();
    expect(screen.queryByTestId('product-grid')).not.toBeInTheDocument();
  });

  it('renders a tile per product in the selected category', () => {
    setup(dairyCategory.id);
    const grid = screen.getByTestId('product-grid');
    expect(grid.querySelectorAll('li')).toHaveLength(dairyCategory.products.length);
    expect(screen.getByTestId(`product-tile-${milk.id}`)).toHaveTextContent('Milk 3%');
  });

  it('shows an empty state for a category with no products', () => {
    setup(emptyCategory.id);
    expect(screen.getByText('This category has no products right now.')).toBeInTheDocument();
  });

  it('selects a category when its chip is clicked', async () => {
    const { user, onCategoryChange } = setup(null);
    await user.click(screen.getByTestId('category-chip-2'));
    expect(onCategoryChange).toHaveBeenCalledWith(2);
  });

  it('deselects when the active chip is clicked again', async () => {
    const { user, onCategoryChange } = setup(dairyCategory.id);
    await user.click(screen.getByTestId(`category-chip-${dairyCategory.id}`));
    expect(onCategoryChange).toHaveBeenCalledWith(null);
  });

  it('adds one unit to the cart when a tile is clicked', async () => {
    const { user, store } = setup(dairyCategory.id);

    await user.click(screen.getByTestId(`product-tile-${milk.id}`));

    expect(store.getState().cart.items[milk.id]?.quantity).toBe(1);
  });

  it('accumulates on repeated clicks and shows the count badge', async () => {
    const { user, store } = setup(dairyCategory.id);
    const tile = screen.getByTestId(`product-tile-${milk.id}`);

    await user.click(tile);
    await user.click(tile);

    expect(store.getState().cart.items[milk.id]?.quantity).toBe(2);
    expect(screen.getByTestId(`tile-badge-${milk.id}`)).toHaveTextContent('2');
  });

  it('hides the badge for products not in the cart', () => {
    setup(dairyCategory.id);
    expect(screen.queryByTestId(`tile-badge-${milk.id}`)).not.toBeInTheDocument();
  });

  it('gives each tile a descriptive accessible name', () => {
    setup(dairyCategory.id);
    expect(screen.getByTestId(`product-tile-${milk.id}`)).toHaveAccessibleName(
      'Quick add Milk 3%',
    );
  });

  it('renders Hebrew product names for the Hebrew locale', () => {
    setup(dairyCategory.id, 'he');
    expect(screen.getByTestId(`product-tile-${milk.id}`)).toHaveTextContent('חלב 3%');
  });
});
