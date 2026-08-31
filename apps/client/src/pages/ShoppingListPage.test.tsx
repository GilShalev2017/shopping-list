import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/renderWithProviders';
import { categories, dairyCategory, milk, uiState } from '@/test/fixtures';
import { CATALOG_BASE_URL } from '@/features/catalog/catalogApi';
import { ShoppingListPage } from './ShoppingListPage';

const renderPage = (locale: 'he' | 'en' = 'en') =>
  renderWithProviders(<ShoppingListPage />, { preloadedState: { ui: uiState(locale) } });

describe('ShoppingListPage', () => {
  it('shows a loading skeleton before the catalog arrives', () => {
    renderPage();
    expect(screen.getByText('Loading the catalog…')).toBeInTheDocument();
  });

  it('loads categories and products on mount (assignment requirement 1)', async () => {
    renderPage();

    await waitForElementToBeRemoved(() => screen.queryByText('Loading the catalog…'));

    const select = screen.getByTestId('category-select');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dairy' })).toBeInTheDocument();
  });

  it('issues exactly one catalog request for both the picker and the grid', async () => {
    let calls = 0;
    server.use(
      http.get(`${CATALOG_BASE_URL}/api/categories`, () => {
        calls += 1;
        return HttpResponse.json(categories);
      }),
    );

    renderPage();
    await screen.findByTestId('product-grid');

    expect(calls).toBe(1);
  });

  it('preselects the first category so the shelf is never empty', async () => {
    renderPage();

    const grid = await screen.findByTestId('product-grid');
    expect(grid).toHaveTextContent('Milk 3%');
    expect(screen.getByTestId('category-select')).toHaveValue(String(dairyCategory.id));
  });

  it('keeps the picker and the grid in sync when the category changes', async () => {
    const { user } = renderPage();
    await screen.findByTestId('product-grid');

    await user.selectOptions(screen.getByTestId('category-select'), '2');

    await waitFor(() =>
      expect(screen.getByTestId('category-chip-2')).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(screen.getByTestId('product-grid')).toHaveTextContent('Bananas');
  });

  it('adds a product to the cart through the dropdown flow', async () => {
    const { user, store } = renderPage();
    await screen.findByTestId('product-grid');

    await user.selectOptions(screen.getByTestId('product-select'), String(milk.id));
    await user.click(screen.getByTestId('add-to-cart'));

    expect(store.getState().cart.items[milk.id]?.quantity).toBe(1);
    expect(screen.getByTestId('cart-list')).toHaveTextContent('Milk 3%');
  });

  it('adds a product to the cart through the grid, and the cart total updates', async () => {
    const { user } = renderPage();
    await screen.findByTestId('product-grid');

    await user.click(screen.getByTestId(`product-tile-${milk.id}`));

    expect(screen.getByTestId('cart-total')).toHaveTextContent('6.90');
  });

  it('shows an error with a retry when the catalog service is down', async () => {
    server.use(
      http.get(`${CATALOG_BASE_URL}/api/categories`, () =>
        HttpResponse.json({ status: 500 }, { status: 500 }),
      ),
    );

    renderPage();

    expect(
      await screen.findByText('The catalog service could not be reached.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByTestId('product-grid')).not.toBeInTheDocument();
  });

  it('recovers when the retry succeeds', async () => {
    let failed = false;
    server.use(
      http.get(`${CATALOG_BASE_URL}/api/categories`, () => {
        if (!failed) {
          failed = true;
          return HttpResponse.json({ status: 500 }, { status: 500 });
        }
        return HttpResponse.json(categories);
      }),
    );

    const { user } = renderPage();
    await screen.findByRole('button', { name: 'Try again' });

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('product-grid')).toBeInTheDocument();
  });

  it('renders entirely in Hebrew for the Hebrew locale', async () => {
    renderPage('he');
    await screen.findByTestId('product-grid');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('רשימת קניות');
    expect(screen.getByTestId('add-to-cart')).toHaveTextContent('הוסף מוצר לסל');
  });
});
