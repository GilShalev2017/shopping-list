import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Category, Product } from '@/types/catalog';

export const CATALOG_BASE_URL =
  (import.meta.env?.VITE_CATALOG_API_URL as string | undefined) ?? 'http://localhost:5080';

/**
 * RTK Query slice for the .NET catalog service.
 *
 * Screen 1 requirement 1 ("the category and product list arrives on page load")
 * is satisfied by a single `useGetCategoriesQuery()` in ShoppingListPage — the
 * response embeds each category's products, so no waterfall is needed.
 */
export const catalogApi = createApi({
  reducerPath: 'catalogApi',
  baseQuery: fetchBaseQuery({ baseUrl: `${CATALOG_BASE_URL}/api` }),
  tagTypes: ['Category', 'Product'],
  // The catalog is effectively static during a session; keep it cached.
  keepUnusedDataFor: 300,
  refetchOnReconnect: true,
  endpoints: (builder) => ({
    getCategories: builder.query<Category[], void>({
      query: () => '/categories',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Category' as const, id })),
              { type: 'Category' as const, id: 'LIST' },
            ]
          : [{ type: 'Category' as const, id: 'LIST' }],
    }),

    getCategory: builder.query<Category, number>({
      query: (id) => `/categories/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Category', id }],
    }),

    getProducts: builder.query<Product[], number | undefined>({
      query: (categoryId) =>
        categoryId === undefined ? '/products' : `/products?categoryId=${categoryId}`,
      providesTags: [{ type: 'Product', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetCategoriesQuery,
  useGetCategoryQuery,
  useGetProductsQuery,
  useLazyGetProductsQuery,
} = catalogApi;
