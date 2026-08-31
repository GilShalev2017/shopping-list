import type { Category, Product } from '@/types/catalog';
import type { Order } from '@/types/orders';
import type { CartItem, CartState } from '@/features/cart/cartSlice';

export const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 101,
  categoryId: 1,
  slug: 'milk-3',
  nameEn: 'Milk 3%',
  nameHe: 'חלב 3%',
  unit: 'carton',
  pricePerUnit: 6.9,
  emoji: '🥛',
  isActive: true,
  ...overrides,
});

export const milk = makeProduct();

export const cottage = makeProduct({
  id: 102,
  slug: 'cottage-5',
  nameEn: 'Cottage cheese 5%',
  nameHe: "קוטג' 5%",
  unit: 'unit',
  pricePerUnit: 7.4,
  emoji: '🧀',
});

export const banana = makeProduct({
  id: 201,
  categoryId: 2,
  slug: 'bananas',
  nameEn: 'Bananas',
  nameHe: 'בננות',
  unit: 'kg',
  pricePerUnit: 8.5,
  emoji: '🍌',
});

export const dairyCategory: Category = {
  id: 1,
  slug: 'dairy',
  nameEn: 'Dairy',
  nameHe: 'מוצרי חלב',
  sortOrder: 1,
  products: [milk, cottage],
};

export const produceCategory: Category = {
  id: 2,
  slug: 'produce',
  nameEn: 'Fruits & Vegetables',
  nameHe: 'פירות וירקות',
  sortOrder: 2,
  products: [banana],
};

export const emptyCategory: Category = {
  id: 3,
  slug: 'bakery',
  nameEn: 'Bakery',
  nameHe: 'מאפים',
  sortOrder: 3,
  products: [],
};

export const categories: Category[] = [dairyCategory, produceCategory, emptyCategory];

export const makeCartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  productId: milk.id,
  categoryId: milk.categoryId,
  slug: milk.slug,
  nameEn: milk.nameEn,
  nameHe: milk.nameHe,
  unit: milk.unit,
  unitPrice: milk.pricePerUnit,
  emoji: milk.emoji,
  quantity: 2,
  ...overrides,
});

/** Builds a populated cart slice for `renderWithProviders({ preloadedState })`. */
export const makeCartState = (items: CartItem[]): CartState => ({
  items: Object.fromEntries(items.map((item) => [item.productId, item])),
  ids: items.map((item) => item.productId),
  lastAddedId: null,
});

export const orderFixture: Order = {
  id: 'ord_01HZX',
  reference: 'ORD-8F3A21',
  customer: {
    fullName: 'Dana Levi',
    address: 'Herzl 10, Tel Aviv',
    email: 'dana@example.com',
  },
  items: [
    {
      productId: milk.id,
      categoryId: milk.categoryId,
      nameEn: milk.nameEn,
      nameHe: milk.nameHe,
      unit: milk.unit,
      quantity: 2,
      unitPrice: 6.9,
      lineTotal: 13.8,
    },
  ],
  itemCount: 2,
  totalAmount: 13.8,
  currency: 'ILS',
  locale: 'he',
  status: 'confirmed',
  createdAt: '2026-08-31T09:00:00.000Z',
};

/** Convenience UI slice presets for `renderWithProviders({ preloadedState })`. */
export const uiState = (
  locale: 'he' | 'en' = 'en',
  theme: 'light' | 'dark' | 'system' = 'system',
) => ({ locale, theme }) as const;
