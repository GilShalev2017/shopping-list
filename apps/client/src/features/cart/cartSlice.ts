import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Product } from '@/types/catalog';
import type { OrderItemPayload } from '@/types/orders';
import type { RootState } from '@/app/store';

export const MAX_QUANTITY = 999;
export const MIN_QUANTITY = 1;

export interface CartItem {
  productId: number;
  categoryId: number;
  slug: string;
  nameEn: string;
  nameHe: string;
  unit: Product['unit'];
  unitPrice: number;
  emoji: string;
  quantity: number;
}

export interface CartState {
  /** Keyed by productId so quantity updates are O(1) and never duplicate a line. */
  items: Record<number, CartItem>;
  /** Insertion order of productIds — Object key order is not a contract we want to rely on. */
  ids: number[];
  /** Drives the "just added" highlight animation on the cart panel. */
  lastAddedId: number | null;
}

export const initialCartState: CartState = {
  items: {},
  ids: [],
  lastAddedId: null,
};

const clampQuantity = (value: number): number => {
  if (!Number.isFinite(value)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(value)));
};

const cartSlice = createSlice({
  name: 'cart',
  initialState: initialCartState,
  reducers: {
    /**
     * Adds a product, or increments it if it is already in the cart.
     * Screen 1 requirement 3: "add to cart" must reflect on screen immediately.
     */
    itemAdded: {
      reducer(state, action: PayloadAction<{ product: Product; quantity: number }>) {
        const { product, quantity } = action.payload;
        const existing = state.items[product.id];

        if (existing) {
          existing.quantity = clampQuantity(existing.quantity + quantity);
        } else {
          state.items[product.id] = {
            productId: product.id,
            categoryId: product.categoryId,
            slug: product.slug,
            nameEn: product.nameEn,
            nameHe: product.nameHe,
            unit: product.unit,
            unitPrice: product.pricePerUnit,
            emoji: product.emoji,
            quantity: clampQuantity(quantity),
          };
          state.ids.push(product.id);
        }

        state.lastAddedId = product.id;
      },
      prepare(product: Product, quantity = 1) {
        return { payload: { product, quantity } };
      },
    },

    quantityChanged(state, action: PayloadAction<{ productId: number; quantity: number }>) {
      const { productId, quantity } = action.payload;
      const item = state.items[productId];
      if (!item) return;

      if (quantity <= 0) {
        delete state.items[productId];
        state.ids = state.ids.filter((id) => id !== productId);
        if (state.lastAddedId === productId) state.lastAddedId = null;
        return;
      }

      item.quantity = clampQuantity(quantity);
    },

    itemRemoved(state, action: PayloadAction<number>) {
      const productId = action.payload;
      if (!state.items[productId]) return;
      delete state.items[productId];
      state.ids = state.ids.filter((id) => id !== productId);
      if (state.lastAddedId === productId) state.lastAddedId = null;
    },

    cartCleared() {
      return initialCartState;
    },

    highlightCleared(state) {
      state.lastAddedId = null;
    },
  },
});

export const { itemAdded, quantityChanged, itemRemoved, cartCleared, highlightCleared } =
  cartSlice.actions;

export const cartReducer = cartSlice.reducer;
export default cartSlice.reducer;

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

export const selectCartState = (state: RootState): CartState => state.cart;

export const selectCartItems = createSelector(
  [selectCartState],
  (cart): CartItem[] =>
    cart.ids.map((id) => cart.items[id]).filter((item): item is CartItem => Boolean(item)),
);

export const selectCartItemCount = createSelector([selectCartItems], (items) =>
  items.reduce((sum, item) => sum + item.quantity, 0),
);

export const selectCartLineCount = createSelector([selectCartItems], (items) => items.length);

export const selectCartTotal = createSelector([selectCartItems], (items) =>
  Number(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)),
);

export const selectIsCartEmpty = createSelector([selectCartItems], (items) => items.length === 0);

export const selectLastAddedId = createSelector([selectCartState], (cart) => cart.lastAddedId);

export const selectCartQuantityFor = (productId: number) =>
  createSelector([selectCartState], (cart) => cart.items[productId]?.quantity ?? 0);

/** Maps the cart into the exact payload the orders API expects. */
export const selectOrderItems = createSelector([selectCartItems], (items): OrderItemPayload[] =>
  items.map((item) => ({
    productId: item.productId,
    categoryId: item.categoryId,
    nameEn: item.nameEn,
    nameHe: item.nameHe,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  })),
);
