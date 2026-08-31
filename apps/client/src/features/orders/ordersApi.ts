import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { CreateOrderPayload, Order } from '@/types/orders';

export const ORDERS_BASE_URL =
  (import.meta.env?.VITE_ORDERS_API_URL as string | undefined) ?? 'http://localhost:3000';

export interface OrdersListResponse {
  total: number;
  items: Order[];
}

/**
 * RTK Query slice for the NestJS orders service. Which NoSQL store sits behind
 * it (Elasticsearch or MongoDB) is a server-side concern — the client cannot
 * tell, which is the point of the pluggable repository on that side.
 */
export const ordersApi = createApi({
  reducerPath: 'ordersApi',
  baseQuery: fetchBaseQuery({ baseUrl: `${ORDERS_BASE_URL}/api` }),
  tagTypes: ['Order'],
  endpoints: (builder) => ({
    createOrder: builder.mutation<Order, CreateOrderPayload>({
      query: (body) => ({
        url: '/orders',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Order', id: 'LIST' }],
    }),

    getOrder: builder.query<Order, string>({
      query: (id) => `/orders/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Order', id }],
    }),

    listOrders: builder.query<OrdersListResponse, { limit?: number; offset?: number } | void>({
      query: (args) => {
        const { limit = 20, offset = 0 } = args ?? {};
        return `/orders?limit=${limit}&offset=${offset}`;
      },
      providesTags: [{ type: 'Order', id: 'LIST' }],
    }),
  }),
});

export const { useCreateOrderMutation, useGetOrderQuery, useListOrdersQuery } = ordersApi;
