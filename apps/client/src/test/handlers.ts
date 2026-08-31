import { http, HttpResponse } from 'msw';
import { CATALOG_BASE_URL } from '@/features/catalog/catalogApi';
import { ORDERS_BASE_URL } from '@/features/orders/ordersApi';
import { categories, orderFixture } from './fixtures';
import type { CreateOrderPayload } from '@/types/orders';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Default happy-path handlers. Individual tests override these with
 * `server.use(...)` to exercise failures, so no test depends on a real backend.
 */
export const handlers = [
  http.get(`${CATALOG_BASE_URL}/api/categories`, () => HttpResponse.json(categories)),

  http.get(`${CATALOG_BASE_URL}/api/categories/:id`, ({ params }) => {
    const category = categories.find((item) => item.id === Number(params.id));
    return category
      ? HttpResponse.json(category)
      : HttpResponse.json({ title: 'Not Found', status: 404 }, { status: 404 });
  }),

  http.get(`${CATALOG_BASE_URL}/api/products`, ({ request }) => {
    const categoryId = new URL(request.url).searchParams.get('categoryId');
    const all = categories.flatMap((category) => category.products);
    return HttpResponse.json(
      categoryId ? all.filter((product) => product.categoryId === Number(categoryId)) : all,
    );
  }),

  // Mirrors the server's contract: totals are recomputed, never trusted.
  http.post(`${ORDERS_BASE_URL}/api/orders`, async ({ request }) => {
    const body = (await request.json()) as CreateOrderPayload;
    const items = body.items.map((item) => ({
      ...item,
      lineTotal: round2(item.quantity * item.unitPrice),
    }));

    return HttpResponse.json(
      {
        ...orderFixture,
        customer: body.customer,
        items,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: round2(items.reduce((sum, item) => sum + item.lineTotal, 0)),
        locale: body.locale,
      },
      { status: 201 },
    );
  }),

  http.get(`${ORDERS_BASE_URL}/api/orders/:id`, ({ params }) =>
    params.id === orderFixture.id
      ? HttpResponse.json(orderFixture)
      : HttpResponse.json({ statusCode: 404, message: 'Not found' }, { status: 404 }),
  ),

  http.get(`${ORDERS_BASE_URL}/api/orders`, () =>
    HttpResponse.json({ total: 1, items: [orderFixture] }),
  ),
];
