import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CART_STORAGE_KEY,
  UI_STORAGE_KEY,
  loadCartState,
  loadUiState,
} from './persistence';
import { createStore } from './store';
import { initialCartState, itemAdded, itemRemoved, quantityChanged } from '@/features/cart/cartSlice';
import { initialUiState, localeChanged, themeChanged } from '@/features/ui/uiSlice';
import { makeCartItem, makeCartState, milk } from '@/test/fixtures';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('loadCartState', () => {
  it('returns the empty cart when nothing is stored', () => {
    expect(loadCartState()).toEqual(initialCartState);
  });

  it('restores a valid persisted cart', () => {
    const stored = makeCartState([makeCartItem({ quantity: 3 })]);
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ items: stored.items, ids: stored.ids }),
    );

    const loaded = loadCartState();
    expect(loaded.ids).toEqual([milk.id]);
    expect(loaded.items[milk.id]?.quantity).toBe(3);
    expect(loaded.lastAddedId).toBeNull();
  });

  it.each([
    ['malformed json', 'definitely-not-json'],
    ['a non-object', JSON.stringify(42)],
    ['a missing items map', JSON.stringify({ ids: [1] })],
    ['a non-array ids field', JSON.stringify({ items: {}, ids: 'nope' })],
  ])('falls back to the empty cart for %s', (_label, raw) => {
    window.localStorage.setItem(CART_STORAGE_KEY, raw);
    expect(loadCartState()).toEqual(initialCartState);
  });

  it.each([
    ['a non-numeric id', { items: { a: { productId: 1, quantity: 1, unitPrice: 1 } }, ids: ['a'] }],
    ['an id with no item', { items: {}, ids: [7] }],
    ['an item missing productId', { items: { 7: { quantity: 1, unitPrice: 1 } }, ids: [7] }],
    ['a zero quantity', { items: { 7: { productId: 7, quantity: 0, unitPrice: 1 } }, ids: [7] }],
    ['a missing price', { items: { 7: { productId: 7, quantity: 1 } }, ids: [7] }],
  ])('drops %s', (_label, raw) => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(raw));
    expect(loadCartState().ids).toEqual([]);
  });

  it('survives localStorage throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(loadCartState()).toEqual(initialCartState);
  });
});

describe('loadUiState', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadUiState()).toEqual(initialUiState);
  });

  it('restores a valid persisted preference', () => {
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ theme: 'dark', locale: 'en' }));
    expect(loadUiState()).toEqual({ theme: 'dark', locale: 'en' });
  });

  it('ignores unknown values field by field', () => {
    window.localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({ theme: 'neon', locale: 'fr' }),
    );
    expect(loadUiState()).toEqual(initialUiState);
  });

  it('keeps the valid half of a partly invalid preference', () => {
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ theme: 'dark', locale: 'fr' }));
    expect(loadUiState()).toEqual({ theme: 'dark', locale: initialUiState.locale });
  });

  it('falls back when the stored value is not an object', () => {
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify('dark'));
    expect(loadUiState()).toEqual(initialUiState);
  });
});

describe('persistence middleware', () => {
  const readCart = () =>
    JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '{}') as {
      ids?: number[];
    };

  it('writes the cart after an add', () => {
    const store = createStore();
    store.dispatch(itemAdded(milk, 2));
    expect(readCart().ids).toEqual([milk.id]);
  });

  it('writes the cart after a quantity change and a removal', () => {
    const store = createStore();
    store.dispatch(itemAdded(milk, 2));
    store.dispatch(quantityChanged({ productId: milk.id, quantity: 5 }));
    expect(
      (JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) as string) as {
        items: Record<string, { quantity: number }>;
      }).items[milk.id]?.quantity,
    ).toBe(5);

    store.dispatch(itemRemoved(milk.id));
    expect(readCart().ids).toEqual([]);
  });

  it('writes UI preferences on change', () => {
    const store = createStore();
    store.dispatch(themeChanged('dark'));
    store.dispatch(localeChanged('en'));

    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) as string)).toEqual({
      theme: 'dark',
      locale: 'en',
    });
  });

  it('does not persist unrelated actions', () => {
    const store = createStore();
    store.dispatch({ type: 'some/unrelatedAction' });
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(UI_STORAGE_KEY)).toBeNull();
  });

  it('keeps working when writing to storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const store = createStore();
    expect(() => store.dispatch(itemAdded(milk, 1))).not.toThrow();
    expect(store.getState().cart.ids).toEqual([milk.id]);
  });
});
