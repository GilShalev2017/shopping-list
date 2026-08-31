import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { banana, categories, dairyCategory, milk, uiState } from '@/test/fixtures';
import { ProductPicker } from './ProductPicker';

const setup = (selectedCategoryId: number | null = null, locale: 'he' | 'en' = 'en') => {
  const onCategoryChange = vi.fn();
  const utils = renderWithProviders(
    <ProductPicker
      categories={categories}
      selectedCategoryId={selectedCategoryId}
      onCategoryChange={onCategoryChange}
    />,
    { preloadedState: { ui: uiState(locale) } },
  );
  return { onCategoryChange, ...utils };
};

describe('ProductPicker', () => {
  it('lists every category as an option', () => {
    setup();
    const select = screen.getByTestId('category-select');
    expect(within(select).getAllByRole('option')).toHaveLength(categories.length + 1);
    expect(within(select).getByRole('option', { name: 'Dairy' })).toBeInTheDocument();
  });

  it('disables the product select until a category is chosen', () => {
    setup();
    expect(screen.getByTestId('product-select')).toBeDisabled();
    expect(screen.getByText('Select a category first')).toBeInTheDocument();
  });

  it('enables the product select and lists that category’s products', () => {
    setup(dairyCategory.id);
    const select = screen.getByTestId('product-select');

    expect(select).toBeEnabled();
    // placeholder + the two dairy products
    expect(within(select).getAllByRole('option')).toHaveLength(3);
    expect(within(select).getByRole('option', { name: /Milk 3%/ })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: /Bananas/ })).not.toBeInTheDocument();
  });

  it('reports the chosen category upward', async () => {
    const { user, onCategoryChange } = setup();

    await user.selectOptions(screen.getByTestId('category-select'), String(dairyCategory.id));
    expect(onCategoryChange).toHaveBeenCalledWith(dairyCategory.id);
  });

  it('reports null when the category is cleared', async () => {
    const { user, onCategoryChange } = setup(dairyCategory.id);

    await user.selectOptions(screen.getByTestId('category-select'), '');
    expect(onCategoryChange).toHaveBeenCalledWith(null);
  });

  it('shows a placeholder telling the user a category has no products', () => {
    setup(3); // the empty bakery category
    expect(screen.getByRole('option', { name: 'This category has no products right now.' }))
      .toBeInTheDocument();
  });

  it('keeps the add button disabled until a product is selected', async () => {
    const { user } = setup(dairyCategory.id);
    const addButton = screen.getByTestId('add-to-cart');
    expect(addButton).toBeDisabled();

    await user.selectOptions(screen.getByTestId('product-select'), String(milk.id));
    expect(addButton).toBeEnabled();
  });

  it('shows a live preview with the price for the chosen quantity', async () => {
    const { user } = setup(dairyCategory.id);
    await user.selectOptions(screen.getByTestId('product-select'), String(milk.id));

    const preview = screen.getByTestId('picker-preview');
    expect(preview).toHaveTextContent('Milk 3%');
    expect(preview).toHaveTextContent('6.90');

    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByTestId('picker-preview')).toHaveTextContent('13.80');
  });

  it('adds the selected product and quantity to the cart', async () => {
    const { user, store } = setup(dairyCategory.id);

    await user.selectOptions(screen.getByTestId('product-select'), String(milk.id));
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await user.click(screen.getByTestId('add-to-cart'));

    const cart = store.getState().cart;
    expect(cart.ids).toEqual([milk.id]);
    expect(cart.items[milk.id]?.quantity).toBe(2);
  });

  it('resets the quantity to one after adding', async () => {
    const { user } = setup(dairyCategory.id);

    await user.selectOptions(screen.getByTestId('product-select'), String(milk.id));
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await user.click(screen.getByTestId('add-to-cart'));

    expect(screen.getByLabelText('Quantity')).toHaveValue(1);
  });

  it('shows how many of the product are already in the cart', async () => {
    const { user } = setup(dairyCategory.id);

    await user.selectOptions(screen.getByTestId('product-select'), String(milk.id));
    await user.click(screen.getByTestId('add-to-cart'));
    await user.click(screen.getByTestId('add-to-cart'));

    expect(screen.getByTestId('picker-preview')).toHaveTextContent('2 in cart');
  });

  it('clears the product selection when the category changes', async () => {
    const { user, rerender, store } = setup(dairyCategory.id);

    await user.selectOptions(screen.getByTestId('product-select'), String(milk.id));
    expect(screen.getByTestId('picker-preview')).toBeInTheDocument();

    await user.selectOptions(screen.getByTestId('category-select'), '2');
    rerender(
      <ProductPicker
        categories={categories}
        selectedCategoryId={2}
        onCategoryChange={() => {}}
      />,
    );

    expect(screen.queryByTestId('picker-preview')).not.toBeInTheDocument();
    expect(screen.getByTestId('add-to-cart')).toBeDisabled();
    expect(store.getState().cart.ids).toEqual([]);
  });

  it('renders Hebrew names when the locale is Hebrew', () => {
    setup(dairyCategory.id, 'he');
    const select = screen.getByTestId('category-select');
    expect(within(select).getByRole('option', { name: 'מוצרי חלב' })).toBeInTheDocument();
    expect(screen.getByTestId('add-to-cart')).toHaveAccessibleName(/הוסף מוצר לסל/);
  });

  it('exposes the product name in the add button’s accessible name', async () => {
    const { user } = setup(2);
    await user.selectOptions(screen.getByTestId('product-select'), String(banana.id));
    expect(screen.getByTestId('add-to-cart')).toHaveAccessibleName(
      'Add Bananas to the cart',
    );
  });
});
