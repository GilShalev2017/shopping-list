import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { buildConfig } from '../src/config/configuration';
import { ORDER_REFERENCE_PATTERN, ULID_PATTERN } from '../src/common/id.util';
import { ElasticsearchIndexBootstrap } from '../src/persistence/elasticsearch/elasticsearch-index.bootstrap';
import { ElasticsearchConnection } from '../src/persistence/elasticsearch/elasticsearch.provider';
import {
  ORDER_REPOSITORY,
  STORE_HEALTH_INDICATOR,
} from '../src/persistence/order-repository.interface';
import { InMemoryOrderRepository } from './in-memory-order.repository';

const validPayload = () => ({
  customer: {
    fullName: 'ישראל ישראלי',
    address: 'הרצל 10, תל אביב',
    email: 'israel@example.com',
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
});

describe('Orders API (e2e)', () => {
  let app: INestApplication;
  let repository: InMemoryOrderRepository;
  const storeHealth = {
    driver: 'elasticsearch' as const,
    check: jest.fn().mockResolvedValue({ status: 'ok', store: 'connected' }),
  };

  beforeAll(async () => {
    Logger.overrideLogger(false);
    repository = new InMemoryOrderRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Swap the real store for an in-memory one: this suite is about the HTTP
      // surface (routing, validation pipe, status codes), not about a cluster.
      .overrideProvider(ORDER_REPOSITORY)
      .useValue(repository)
      .overrideProvider(STORE_HEALTH_INDICATOR)
      .useValue(storeHealth)
      // The rest of AppModule is booted for real (config, global prefix,
      // validation pipe, Swagger); only the parts that would dial a live
      // cluster are stubbed out.
      .overrideProvider(ElasticsearchIndexBootstrap)
      .useValue({ onModuleInit: jest.fn() })
      .overrideProvider(ElasticsearchConnection)
      .useValue({ onApplicationShutdown: jest.fn() })
      .compile();

    app = configureApp(moduleRef.createNestApplication(), buildConfig({}));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repository.clear();
  });

  const http = (): App => app.getHttpServer() as App;

  // -------------------------------------------------------------------------
  describe('POST /api/orders', () => {
    it('creates an order and returns 201 with the contract shape', async () => {
      const response = await request(http())
        .post('/api/orders')
        .send(validPayload())
        .expect(201);

      expect(response.body).toEqual({
        id: expect.stringMatching(ULID_PATTERN),
        reference: expect.stringMatching(ORDER_REFERENCE_PATTERN),
        customer: {
          fullName: 'ישראל ישראלי',
          address: 'הרצל 10, תל אביב',
          email: 'israel@example.com',
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
            lineTotal: 13.8,
          },
        ],
        itemCount: 2,
        totalAmount: 13.8,
        currency: 'ILS',
        locale: 'he',
        status: 'confirmed',
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it('computes totals across several lines', async () => {
      const response = await request(http())
        .post('/api/orders')
        .send({
          ...validPayload(),
          items: [
            { ...validPayload().items[0], quantity: 3, unitPrice: 19.9 },
            {
              ...validPayload().items[0],
              productId: 102,
              quantity: 7,
              unitPrice: 4.15,
            },
          ],
        })
        .expect(201);

      expect(response.body.items.map((i: { lineTotal: number }) => i.lineTotal)).toEqual([
        59.7, 29.05,
      ]);
      expect(response.body.itemCount).toBe(10);
      expect(response.body.totalAmount).toBe(88.75);
    });

    it('defaults locale to "he" when omitted', async () => {
      const payload: Record<string, unknown> = validPayload();
      delete payload.locale;

      const response = await request(http())
        .post('/api/orders')
        .send(payload)
        .expect(201);
      expect(response.body.locale).toBe('he');
    });

    it('ignores a client-supplied total, returning 400 for the unknown property', async () => {
      const response = await request(http())
        .post('/api/orders')
        .send({ ...validPayload(), totalAmount: 0.01 })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('totalAmount')]),
      );
    });

    it.each<[string, object, RegExp]>([
      [
        'a malformed email',
        { ...validPayload(), customer: { ...validPayload().customer, email: 'nope' } },
        /email must be an email/i,
      ],
      [
        'a one-word full name',
        {
          ...validPayload(),
          customer: { ...validPayload().customer, fullName: 'Israel' },
        },
        /fullName must contain at least two words/i,
      ],
      [
        'an empty full name',
        { ...validPayload(), customer: { ...validPayload().customer, fullName: '' } },
        /fullName should not be empty/i,
      ],
      [
        'a too-short address',
        { ...validPayload(), customer: { ...validPayload().customer, address: 'ab' } },
        /address must be longer than or equal to 5/i,
      ],
      [
        'an empty cart',
        { ...validPayload(), items: [] },
        /items must contain at least 1/i,
      ],
      [
        'a quantity of 0',
        { ...validPayload(), items: [{ ...validPayload().items[0], quantity: 0 }] },
        /quantity must not be less than 1/i,
      ],
      [
        'a quantity of 1000',
        { ...validPayload(), items: [{ ...validPayload().items[0], quantity: 1000 }] },
        /quantity must not be greater than 999/i,
      ],
      [
        'a negative price',
        { ...validPayload(), items: [{ ...validPayload().items[0], unitPrice: -1 }] },
        /unitPrice must not be less than 0/i,
      ],
      [
        'an unsupported locale',
        { ...validPayload(), locale: 'fr' },
        /locale must be one of the following values/i,
      ],
      ['an empty body', {}, /customer should not be null or undefined/i],
    ])('rejects %s with 400 and a message array', async (_name, payload, matcher) => {
      const response = await request(http())
        .post('/api/orders')
        .send(payload)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: expect.any(Array),
      });
      expect(response.body.message.join(' | ')).toMatch(matcher);
    });

    it('reports every violation at once rather than stopping at the first', async () => {
      const response = await request(http())
        .post('/api/orders')
        .send({
          customer: { fullName: 'Israel', address: 'ab', email: 'nope' },
          items: [],
        })
        .expect(400);

      const messages = (response.body.message as string[]).join(' | ');
      expect(messages).toMatch(/fullName/);
      expect(messages).toMatch(/address/);
      expect(messages).toMatch(/email/);
      expect(messages).toMatch(/items/);
    });

    it('is not reachable without the /api prefix', async () => {
      await request(http()).post('/orders').send(validPayload()).expect(404);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /api/orders/:id', () => {
    it('returns an order that was just created (read-after-write)', async () => {
      const created = await request(http())
        .post('/api/orders')
        .send(validPayload())
        .expect(201);

      const fetched = await request(http())
        .get(`/api/orders/${created.body.id as string}`)
        .expect(200);

      expect(fetched.body).toEqual(created.body);
    });

    it('returns 404 for an unknown id', async () => {
      const response = await request(http())
        .get('/api/orders/01JUNKJUNKJUNKJUNKJUNKJUNK')
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('was not found'),
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /api/orders', () => {
    const createOrders = async (count: number): Promise<string[]> => {
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        const response = await request(http())
          .post('/api/orders')
          .send(validPayload())
          .expect(201);
        ids.push(response.body.id as string);
        // Keep createdAt strictly increasing so ordering is deterministic.
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      return ids;
    };

    it('returns an empty envelope when there is nothing stored', async () => {
      await request(http()).get('/api/orders').expect(200, { total: 0, items: [] });
    });

    it('returns { total, items } newest first', async () => {
      const ids = await createOrders(3);

      const response = await request(http()).get('/api/orders').expect(200);

      expect(response.body.total).toBe(3);
      expect(response.body.items).toHaveLength(3);
      expect(response.body.items.map((o: { id: string }) => o.id)).toEqual(
        [...ids].reverse(),
      );
    });

    it('applies limit and offset', async () => {
      const ids = await createOrders(5);
      const newestFirst = [...ids].reverse();

      const page = await request(http())
        .get('/api/orders')
        .query({ limit: 2, offset: 1 })
        .expect(200);

      expect(page.body.total).toBe(5);
      expect(page.body.items.map((o: { id: string }) => o.id)).toEqual(
        newestFirst.slice(1, 3),
      );
    });

    it('defaults to limit=20 offset=0', async () => {
      await createOrders(2);
      const response = await request(http()).get('/api/orders').expect(200);
      expect(response.body.items).toHaveLength(2);
    });

    it.each([
      ['limit=0', { limit: 0 }],
      ['limit=101', { limit: 101 }],
      ['offset=-1', { offset: -1 }],
      ['limit=abc', { limit: 'abc' }],
      ['an unknown query parameter', { sort: 'asc' }],
    ])('rejects %s with 400', async (_name, query) => {
      await request(http()).get('/api/orders').query(query).expect(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /health', () => {
    it('returns the contract shape outside the /api prefix', async () => {
      await request(http())
        .get('/health')
        .expect(200, { status: 'ok', driver: 'elasticsearch', store: 'connected' });
    });

    it('returns 503 when the store is unreachable', async () => {
      storeHealth.check.mockResolvedValueOnce({
        status: 'error',
        store: 'disconnected',
        detail: 'ECONNREFUSED',
      });

      const response = await request(http()).get('/health').expect(503);
      expect(response.body).toEqual({
        status: 'error',
        driver: 'elasticsearch',
        store: 'disconnected',
      });
    });

    it('is not mounted under /api', async () => {
      await request(http()).get('/api/health').expect(404);
    });
  });

  // -------------------------------------------------------------------------
  describe('OpenAPI', () => {
    it('documents every contract route', async () => {
      const response = await request(http()).get('/docs-json').expect(200);
      expect(Object.keys(response.body.paths).sort()).toEqual([
        '/api/orders',
        '/api/orders/{id}',
        '/health',
      ]);
    });
  });
});
