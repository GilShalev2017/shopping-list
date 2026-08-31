import { describe, expect, it } from 'vitest';
import {
  MAX_QUANTITY,
  cartCleared,
  cartReducer,
  highlightCleared,
  initialCartState,
  itemAdded,
  itemRemoved,
  quantityChanged,
  selectCartItemCount,
  selectCartItems,
  selectCartLineCount,
  selectCartQuantityFor,
  selectCartTotal,
  selectIsCartEmpty,
  selectLastAddedId,
  selectOrderItems,
  type CartState,
} from './cartSlice';
import { banana, cottage, makeCartItem, makeCartState, milk } from '@/test/fixtures';
import type { RootState } from '@/app/store';

const asRootState = (cart: CartState) => ({ cart }) as RootState;

describe('cartSlice reducer', () => {
  it('starts empty', () => {
    expect(cartReducer(undefined, { type: '@@INIT' })).toEqual(initialCartState);
  });

  describe('itemAdded', () => {
    it('adds a new product with the requested quantity and records insertion order', () => {
      let state = cartReducer(undefined, itemAdded(milk, 2));
      state = cartReducer(state, itemAdded(banana, 1));

      expect(state.ids).toEqual([milk.id, banana.id]);
      expect(state.items[milk.id]).toMatchObject({
        productId: milk.id,
        categoryId: milk.categoryId,
        nameHe: milk.nameHe,
        nameEn: milk.nameEn,
        unitPrice: milk.pricePerUnit,
        quantity: 2,
      });
      expect(state.lastAddedId).toBe(banana.id);
    });

    it('defaults to a quantity of one', () => {
      const state = cartReducer(undefined, itemAdded(milk));
      expect(state.items[milk.id]?.quantity).toBe(1);
    });

    it('increments an existing line instead of duplicating it', () => {
      let state = cartReducer(undefined, itemAdded(milk, 2));
      state = cartReducer(state, itemAdded(milk, 3));

      expect(state.ids).toEqual([milk.id]);
      expect(state.items[milk.id]?.quantity).toBe(5);
    });

    it('clamps an oversized quantity to the maximum', () => {
      const state = cartReducer(undefined, itemAdded(milk, 5_000));
      expect(state.items[milk.id]?.quantity).toBe(MAX_QUANTITY);
    });

    it('clamps an incremented line to the maximum', () => {
      let state = cartReducer(undefined, itemAdded(milk, MAX_QUANTITY));
      state = cartReducer(state, itemAdded(milk, 10));
      expect(state.items[milk.id]?.quantity).toBe(MAX_QUANTITY);
    });

    it.each([
      [0, 1],
      [-4, 1],
      [2.7, 2],
      [Number.NaN, 1],
    ])('normalises a quantity of %s to %s', (input, expected) => {
      const state = cartReducer(undefined, itemAdded(milk, input));
      expect(state.items[milk.id]?.quantity).toBe(expected);
    });
  });

  describe('quantityChanged', () => {
    it('updates the quantity of an existing line', () => {
      const state = cartReducer(
        makeCartState([makeCartItem({ quantity: 2 })]),
        quantityChanged({ productId: milk.id, quantity: 7 }),
      );
      expect(state.items[milk.id]?.quantity).toBe(7);
    });

    it('removes the line when the quantity drops to zero', () => {
      const state = cartReducer(
        makeCartState([makeCartItem()]),
        quantityChanged({ productId: milk.id, quantity: 0 }),
      );
      expect(state.items[milk.id]).toBeUndefined();
      expect(state.ids).toEqual([]);
    });

    it('removes the line for a negative quantity', () => {
      const state = cartReducer(
        makeCartState([makeCartItem()]),
        quantityChanged({ productId: milk.id, quantity: -3 }),
      );
      expect(state.ids).toEqual([]);
    });

    it('clears the highlight when the highlighted line is removed', () => {
      const start: CartState = { ...makeCartState([makeCartItem()]), lastAddedId: milk.id };
      const state = cartReducer(start, quantityChanged({ productId: milk.id, quantity: 0 }));
      expect(state.lastAddedId).toBeNull();
    });

    it('ignores an unknown product', () => {
      const start = makeCartState([makeCartItem()]);
      const state = cartReducer(start, quantityChanged({ productId: 9_999, quantity: 4 }));
      expect(state).toEqual(start);
    });

    it('clamps above the maximum', () => {
      const state = cartReducer(
        makeCartState([makeCartItem()]),
        quantityChanged({ productId: milk.id, quantity: 10_000 }),
      );
      expect(state.items[milk.id]?.quantity).toBe(MAX_QUANTITY);
    });
  });

  describe('itemRemoved', () => {
    it('removes the line and its id', () => {
      const start = makeCartState([
        makeCartItem(),
        makeCartItem({ productId: banana.id, quantity: 1 }),
      ]);
      const state = cartReducer(start, itemRemoved(milk.id));

      expect(state.ids).toEqual([banana.id]);
      expect(state.items[milk.id]).toBeUndefined();
    });

    it('is a no-op for an unknown product', () => {
      const start = makeCartState([makeCartItem()]);
      expect(cartReducer(start, itemRemoved(4_242))).toEqual(start);
    });

    it('clears the highlight when the highlighted line is removed', () => {
      const start: CartState = { ...makeCartState([makeCartItem()]), lastAddedId: milk.id };
      expect(cartReducer(start, itemRemoved(milk.id)).lastAddedId).toBeNull();
    });
  });

  it('cartCleared resets to the initial state', () => {
    const start = makeCartState([makeCartItem(), makeCartItem({ productId: banana.id })]);
    expect(cartReducer(start, cartCleared())).toEqual(initialCartState);
  });

  it('highlightCleared drops only the highlight', () => {
    const start: CartState = { ...makeCartState([makeCartItem()]), lastAddedId: milk.id };
    const state = cartReducer(start, highlightCleared());

    expect(state.lastAddedId).toBeNull();
    expect(state.ids).toEqual([milk.id]);
  });
});

describe('cart selectors', () => {
  const state = asRootState(
    makeCartState([
      makeCartItem({ quantity: 2, unitPrice: 6.9 }),
      makeCartItem({
        productId: cottage.id,
        nameEn: cottage.nameEn,
        nameHe: cottage.nameHe,
        unit: cottage.unit,
        unitPrice: 7.4,
        quantity: 3,
      }),
    ]),
  );

  it('returns items in insertion order', () => {
    expect(selectCartItems(state).map((item) => item.productId)).toEqual([milk.id, cottage.id]);
  });

  it('sums quantities for the item count', () => {
    expect(selectCartItemCount(state)).toBe(5);
  });

  it('counts distinct lines separately from quantities', () => {
    expect(selectCartLineCount(state)).toBe(2);
  });

  it('computes the total, rounded to two decimals', () => {
    // 2 * 6.90 + 3 * 7.40 = 13.80 + 22.20
    expect(selectCartTotal(state)).toBe(36);
  });

  it('avoids floating point drift', () => {
    const drifting = asRootState(
      makeCartState([makeCartItem({ quantity: 3, unitPrice: 0.1 })]),
    );
    expect(selectCartTotal(drifting)).toBe(0.3);
  });

  it('reports emptiness', () => {
    expect(selectIsCartEmpty(state)).toBe(false);
    expect(selectIsCartEmpty(asRootState(initialCartState))).toBe(true);
  });

  it('exposes the last added id', () => {
    expect(selectLastAddedId(state)).toBeNull();
  });

  it('reads the quantity for one product, and zero for an absent one', () => {
    expect(selectCartQuantityFor(milk.id)(state)).toBe(2);
    expect(selectCartQuantityFor(9_999)(state)).toBe(0);
  });

  it('maps the cart into the orders API payload shape', () => {
    expect(selectOrderItems(state)).toEqual([
      {
        productId: milk.id,
        categoryId: milk.categoryId,
        nameEn: milk.nameEn,
        nameHe: milk.nameHe,
        unit: milk.unit,
        quantity: 2,
        unitPrice: 6.9,
      },
      {
        productId: cottage.id,
        categoryId: milk.categoryId,
        nameEn: cottage.nameEn,
        nameHe: cottage.nameHe,
        unit: cottage.unit,
        quantity: 3,
        unitPrice: 7.4,
      },
    ]);
  });

  it('skips ids that have no matching item (defensive against bad persisted state)', () => {
    const broken = asRootState({ items: {}, ids: [milk.id], lastAddedId: null });
    expect(selectCartItems(broken)).toEqual([]);
  });
});
