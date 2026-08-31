import { Test, TestingModule } from '@nestjs/testing';

import {
  ORDER_REPOSITORY,
  STORE_HEALTH_INDICATOR,
  StoreHealthIndicator,
} from './persistence/order-repository.interface';

/**
 * `AppModule` evaluates `PersistenceModule.forRoot()` while the module file is
 * being loaded, so the driver has to be chosen *before* the import. Each case
 * therefore requires the module inside an isolated registry.
 *
 * Everything compared against must come from that same registry — an isolated
 * `require` produces distinct class objects, so a class imported at the top of
 * this file would not be the class the container registered.
 *
 * Modules are only `compile()`d, never `init()`ed: initialising would fire the
 * Elasticsearch/Mongo bootstrap hooks against stores that are not running here.
 */
interface IsolatedApp {
  moduleRef: TestingModule;
  OrdersController: unknown;
  OrdersService: unknown;
  HealthController: unknown;
  ElasticsearchOrderRepository: unknown;
  MongoOrderRepository: unknown;
}

async function compileAppModule(driver: string): Promise<IsolatedApp> {
  const previous = process.env.NOSQL_DRIVER;
  process.env.NOSQL_DRIVER = driver;

  const isolated: Record<string, unknown> = {};
  let AppModule!: new () => unknown;

  try {
    jest.isolateModules(() => {
      /* eslint-disable @typescript-eslint/no-require-imports */
      AppModule = (require('./app.module') as { AppModule: new () => unknown }).AppModule;
      isolated.OrdersController = (
        require('./orders/orders.controller') as Record<string, unknown>
      ).OrdersController;
      isolated.OrdersService = (
        require('./orders/orders.service') as Record<string, unknown>
      ).OrdersService;
      isolated.HealthController = (
        require('./health/health.controller') as Record<string, unknown>
      ).HealthController;
      isolated.ElasticsearchOrderRepository = (
        require('./persistence/elasticsearch/elasticsearch-order.repository') as Record<
          string,
          unknown
        >
      ).ElasticsearchOrderRepository;
      isolated.MongoOrderRepository = (
        require('./persistence/mongodb/mongo-order.repository') as Record<string, unknown>
      ).MongoOrderRepository;
      /* eslint-enable @typescript-eslint/no-require-imports */
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    return { moduleRef, ...isolated } as IsolatedApp;
  } finally {
    if (previous === undefined) {
      delete process.env.NOSQL_DRIVER;
    } else {
      process.env.NOSQL_DRIVER = previous;
    }
  }
}

describe('AppModule', () => {
  describe('with the default elasticsearch driver', () => {
    let app: IsolatedApp;

    beforeAll(async () => {
      app = await compileAppModule('elasticsearch');
    });

    afterAll(async () => {
      await app.moduleRef.close();
    });

    it('wires the whole application graph', () => {
      expect(app.moduleRef.get(app.OrdersController as never)).toBeInstanceOf(
        app.OrdersController as never,
      );
      expect(app.moduleRef.get(app.OrdersService as never)).toBeInstanceOf(
        app.OrdersService as never,
      );
      expect(app.moduleRef.get(app.HealthController as never)).toBeInstanceOf(
        app.HealthController as never,
      );
    });

    it('resolves ORDER_REPOSITORY to the Elasticsearch adapter', () => {
      expect(app.moduleRef.get(ORDER_REPOSITORY)).toBeInstanceOf(
        app.ElasticsearchOrderRepository as never,
      );
    });

    it('reports elasticsearch as the live driver on the health port', () => {
      expect(app.moduleRef.get<StoreHealthIndicator>(STORE_HEALTH_INDICATOR).driver).toBe(
        'elasticsearch',
      );
    });
  });

  describe('with NOSQL_DRIVER=mongodb', () => {
    let app: IsolatedApp;

    beforeAll(async () => {
      app = await compileAppModule('mongodb');
    });

    afterAll(async () => {
      await app.moduleRef.close();
    });

    it('wires the identical application graph', () => {
      expect(app.moduleRef.get(app.OrdersController as never)).toBeInstanceOf(
        app.OrdersController as never,
      );
      expect(app.moduleRef.get(app.OrdersService as never)).toBeInstanceOf(
        app.OrdersService as never,
      );
      expect(app.moduleRef.get(app.HealthController as never)).toBeInstanceOf(
        app.HealthController as never,
      );
    });

    it('resolves ORDER_REPOSITORY to the MongoDB adapter instead', () => {
      expect(app.moduleRef.get(ORDER_REPOSITORY)).toBeInstanceOf(
        app.MongoOrderRepository as never,
      );
    });

    it('reports mongodb as the live driver on the health port', () => {
      expect(app.moduleRef.get<StoreHealthIndicator>(STORE_HEALTH_INDICATOR).driver).toBe(
        'mongodb',
      );
    });
  });
});

// An unsupported NOSQL_DRIVER is rejected before the container is ever built —
// by `validationSchema` inside `ConfigModule.forRoot()` and by `buildConfig()`
// inside `PersistenceModule.forRoot()`. Both are covered in
// `config/configuration.spec.ts`; asserting it here would mean loading a module
// that throws at import time, which cannot be contained inside a test.
