import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { createStore } from '@/app/store';
import { CATALOG_BASE_URL, catalogApi } from './catalogApi';
import { categories, dairyCategory, milk } from '@/test/fixtures';

const withStore = () => createStore();

describe('catalogApi', () => {
  it('points at the configured base url', () => {
    expect(CATALOG_BASE_URL).toMatch(/^https?:\/\//);
  });

  it('fetches every category with its products in one request', async () => {
    const store = withStore();
    const result = await store.dispatch(catalogApi.endpoints.getCategories.initiate());

    expect(result.data).toEqual(categories);
    expect(result.data?.[0]?.products).toHaveLength(2);
  });

  it('caches a repeated query rather than refetching', async () => {
    let calls = 0;
    server.use(
      http.get(`${CATALOG_BASE_URL}/api/categories`, () => {
        calls += 1;
        return HttpResponse.json(categories);
      }),
    );

    const store = withStore();
    await store.dispatch(catalogApi.endpoints.getCategories.initiate());
    await store.dispatch(catalogApi.endpoints.getCategories.initiate());

    expect(calls).toBe(1);
  });

  it('surfaces a server error instead of throwing', async () => {
    server.use(
      http.get(`${CATALOG_BASE_URL}/api/categories`, () =>
        HttpResponse.json({ title: 'Server Error', status: 500 }, { status: 500 }),
      ),
    );

    const store = withStore();
    const result = await store.dispatch(catalogApi.endpoints.getCategories.initiate());

    expect(result.isError).toBe(true);
    expect(result.error).toMatchObject({ status: 500 });
  });

  it('surfaces a network failure', async () => {
    server.use(
      http.get(`${CATALOG_BASE_URL}/api/categories`, () => HttpResponse.error()),
    );

    const store = withStore();
    const result = await store.dispatch(catalogApi.endpoints.getCategories.initiate());

    expect(result.isError).toBe(true);
    expect(result.error).toMatchObject({ status: 'FETCH_ERROR' });
  });

  it('fetches a single category', async () => {
    const store = withStore();
    const result = await store.dispatch(
      catalogApi.endpoints.getCategory.initiate(dairyCategory.id),
    );

    expect(result.data).toEqual(dairyCategory);
  });

  it('reports 404 for an unknown category', async () => {
    const store = withStore();
    const result = await store.dispatch(catalogApi.endpoints.getCategory.initiate(9_999));

    expect(result.error).toMatchObject({ status: 404 });
  });

  it('fetches all products when no category is given', async () => {
    const store = withStore();
    const result = await store.dispatch(catalogApi.endpoints.getProducts.initiate(undefined));

    expect(result.data).toHaveLength(3);
  });

  it('filters products by category', async () => {
    const store = withStore();
    const result = await store.dispatch(
      catalogApi.endpoints.getProducts.initiate(dairyCategory.id),
    );

    expect(result.data?.map((product) => product.id)).toContain(milk.id);
    expect(result.data?.every((product) => product.categoryId === dairyCategory.id)).toBe(true);
  });

  it('tags results so a cache invalidation can target them', () => {
    const store = withStore();
    expect(store.getState()[catalogApi.reducerPath]).toBeDefined();
    expect(catalogApi.reducerPath).toBe('catalogApi');
  });
});
