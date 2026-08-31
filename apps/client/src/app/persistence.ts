import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import {
  cartCleared,
  initialCartState,
  itemAdded,
  itemRemoved,
  quantityChanged,
  type CartState,
} from '@/features/cart/cartSlice';
import {
  initialUiState,
  localeChanged,
  localeToggled,
  themeChanged,
  themeToggled,
  type UiState,
} from '@/features/ui/uiSlice';

export const CART_STORAGE_KEY = 'shopping-list.cart';
export const UI_STORAGE_KEY = 'shopping-list.ui';

/**
 * localStorage is not available in every context (private mode, SSR, a test
 * environment that has torn it down), so every access is guarded. A storage
 * failure must never take the app down — it just means state is not persisted.
 */
const safeRead = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
};

const safeWrite = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled — non-fatal */
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Validates the persisted cart rather than trusting whatever is in storage. */
export const loadCartState = (): CartState => {
  const raw = safeRead(CART_STORAGE_KEY);
  if (!isRecord(raw) || !isRecord(raw.items) || !Array.isArray(raw.ids)) {
    return initialCartState;
  }

  const items: CartState['items'] = {};
  const ids: number[] = [];

  for (const id of raw.ids) {
    if (typeof id !== 'number') continue;
    const candidate = (raw.items as Record<string, unknown>)[String(id)];
    if (!isRecord(candidate)) continue;
    if (typeof candidate.productId !== 'number') continue;
    if (typeof candidate.quantity !== 'number' || candidate.quantity < 1) continue;
    if (typeof candidate.unitPrice !== 'number') continue;

    items[id] = candidate as unknown as CartState['items'][number];
    ids.push(id);
  }

  return { items, ids, lastAddedId: null };
};

export const loadUiState = (): UiState => {
  const raw = safeRead(UI_STORAGE_KEY);
  if (!isRecord(raw)) return initialUiState;

  const theme =
    raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system'
      ? raw.theme
      : initialUiState.theme;
  const locale = raw.locale === 'he' || raw.locale === 'en' ? raw.locale : initialUiState.locale;

  return { theme, locale };
};

export const persistenceMiddleware = createListenerMiddleware();

persistenceMiddleware.startListening({
  matcher: isAnyOf(itemAdded, itemRemoved, quantityChanged, cartCleared),
  effect: (_action, api) => {
    const { cart } = api.getState() as { cart: CartState };
    safeWrite(CART_STORAGE_KEY, { items: cart.items, ids: cart.ids });
  },
});

persistenceMiddleware.startListening({
  matcher: isAnyOf(themeChanged, themeToggled, localeChanged, localeToggled),
  effect: (_action, api) => {
    const { ui } = api.getState() as { ui: UiState };
    safeWrite(UI_STORAGE_KEY, ui);
  },
});
