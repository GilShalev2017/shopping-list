import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { createStore } from '@/app/store';
import { ORDERS_BASE_URL, ordersApi } from './ordersApi';
import { orderFixture } from '@/test/fixtures';
import type { CreateOrderPayload } from '@/types/orders';

const payload: CreateOrderPayload = {
  customer: {
    fullName: 'Dana Levi',
    address: 'Herzl 10, Tel Aviv',
    email: 'dana@example.com',
  },
  items: [
    {
      productId: 101,
      categoryId: 1,
      nameEn: 'Milk 3%',
      nameHe: 'חלב 3%',
      unit: 'carton',
      quantity: 2,
      unitPrice: 6.9,
    },
  ],
  locale: 'he',
};

describe('ordersApi', () => {
  it('posts an order and returns the persisted representation', async () => {
    const store = createStore();
    const result = await store.dispatch(ordersApi.endpoints.createOrder.initiate(payload));

    expect('data' in result && result.data).toMatchObject({
      reference: orderFixture.reference,
      itemCount: 2,
      totalAmount: 13.8,
      currency: 'ILS',
      status: 'confirmed',
    });
  });

  it('sends the exact contract payload on the wire', async () => {
    let received: unknown;
    server.use(
      http.post(`${ORDERS_BASE_URL}/api/orders`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(orderFixture, { status: 201 });
      }),
    );

    const store = createStore();
    await store.dispatch(ordersApi.endpoints.createOrder.initiate(payload));

    expect(received).toEqual(payload);
  });

  it('propagates a validation failure from the server', async () => {
    server.use(
      http.post(`${ORDERS_BASE_URL}/api/orders`, () =>
        HttpResponse.json(
          { statusCode: 400, error: 'Bad Request', message: ['customer.email must be an email'] },
          { status: 400 },
        ),
      ),
    );

    const store = createStore();
    const result = await store.dispatch(ordersApi.endpoints.createOrder.initiate(payload));

    expect('error' in result && result.error).toMatchObject({ status: 400 });
  });

  it('propagates a network failure', async () => {
    server.use(http.post(`${ORDERS_BASE_URL}/api/orders`, () => HttpResponse.error()));

    const store = createStore();
    const result = await store.dispatch(ordersApi.endpoints.createOrder.initiate(payload));

    expect('error' in result && result.error).toMatchObject({ status: 'FETCH_ERROR' });
  });

  it('fetches an order by id', async () => {
    const store = createStore();
    const result = await store.dispatch(
      ordersApi.endpoints.getOrder.initiate(orderFixture.id),
    );

    expect(result.data).toEqual(orderFixture);
  });

  it('reports 404 for an unknown order', async () => {
    const store = createStore();
    const result = await store.dispatch(ordersApi.endpoints.getOrder.initiate('nope'));

    expect(result.error).toMatchObject({ status: 404 });
  });

  it('lists orders with default pagination', async () => {
    let url = '';
    server.use(
      http.get(`${ORDERS_BASE_URL}/api/orders`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ total: 1, items: [orderFixture] });
      }),
    );

    const store = createStore();
    const result = await store.dispatch(ordersApi.endpoints.listOrders.initiate());

    expect(result.data).toEqual({ total: 1, items: [orderFixture] });
    expect(url).toContain('limit=20');
    expect(url).toContain('offset=0');
  });

  it('honours explicit pagination arguments', async () => {
    let url = '';
    server.use(
      http.get(`${ORDERS_BASE_URL}/api/orders`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ total: 0, items: [] });
      }),
    );

    const store = createStore();
    await store.dispatch(ordersApi.endpoints.listOrders.initiate({ limit: 5, offset: 10 }));

    expect(url).toContain('limit=5');
    expect(url).toContain('offset=10');
  });
});
