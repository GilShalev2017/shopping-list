import { Test, TestingModule } from '@nestjs/testing';

import { AppConfig, buildConfig } from '../config/configuration';
import { ElasticsearchOrderRepository } from './elasticsearch/elasticsearch-order.repository';
import { ElasticsearchStoreHealthIndicator } from './elasticsearch/elasticsearch.provider';
import { MongoOrderRepository } from './mongodb/mongo-order.repository';
import { MongoStoreHealthIndicator } from './mongodb/mongo.provider';
import {
  ORDER_REPOSITORY,
  OrderRepository,
  STORE_HEALTH_INDICATOR,
  StoreHealthIndicator,
} from './order-repository.interface';
import {
  PersistenceModule,
  elasticsearchDriverProviders,
  mongoDriverProviders,
} from './persistence.module';

const configFor = (driver: string): AppConfig => buildConfig({ NOSQL_DRIVER: driver });

async function compile(config: AppConfig): Promise<TestingModule> {
  const moduleRef = await Test.createTestingModule({
    imports: [PersistenceModule.forRoot(config)],
  }).compile();
  // Not `init()`: that would run the ES/Mongo bootstrap hooks against a store
  // that is not running. Wiring is what this suite is about.
  return moduleRef;
}

describe('PersistenceModule.forRoot', () => {
  describe('elasticsearch (the default driver)', () => {
    let moduleRef: TestingModule;

    beforeAll(async () => {
      moduleRef = await compile(configFor('elasticsearch'));
    });

    afterAll(async () => {
      await moduleRef.close();
    });

    it('binds ORDER_REPOSITORY to the Elasticsearch adapter', () => {
      const repository = moduleRef.get<OrderRepository>(ORDER_REPOSITORY);
      expect(repository).toBeInstanceOf(ElasticsearchOrderRepository);
    });

    it('binds STORE_HEALTH_INDICATOR to the Elasticsearch probe', () => {
      const indicator = moduleRef.get<StoreHealthIndicator>(STORE_HEALTH_INDICATOR);
      expect(indicator).toBeInstanceOf(ElasticsearchStoreHealthIndicator);
      expect(indicator.driver).toBe('elasticsearch');
    });

    it('does not register the MongoDB adapter', () => {
      expect(() => moduleRef.get(MongoOrderRepository)).toThrow();
    });
  });

  describe('mongodb', () => {
    let moduleRef: TestingModule;

    beforeAll(async () => {
      moduleRef = await compile(configFor('mongodb'));
    });

    afterAll(async () => {
      await moduleRef.close();
    });

    it('binds ORDER_REPOSITORY to the MongoDB adapter', () => {
      const repository = moduleRef.get<OrderRepository>(ORDER_REPOSITORY);
      expect(repository).toBeInstanceOf(MongoOrderRepository);
    });

    it('binds STORE_HEALTH_INDICATOR to the MongoDB probe', () => {
      const indicator = moduleRef.get<StoreHealthIndicator>(STORE_HEALTH_INDICATOR);
      expect(indicator).toBeInstanceOf(MongoStoreHealthIndicator);
      expect(indicator.driver).toBe('mongodb');
    });

    it('does not register the Elasticsearch adapter', () => {
      expect(() => moduleRef.get(ElasticsearchOrderRepository)).toThrow();
    });
  });

  describe('module shape', () => {
    it('is global and exports exactly the two ports', () => {
      const dynamic = PersistenceModule.forRoot(configFor('elasticsearch'));
      expect(dynamic.module).toBe(PersistenceModule);
      expect(dynamic.global).toBe(true);
      expect(dynamic.exports).toEqual([ORDER_REPOSITORY, STORE_HEALTH_INDICATOR]);
    });

    it('registers exactly one implementation per token, whichever driver is chosen', () => {
      for (const driver of ['elasticsearch', 'mongodb']) {
        const { providers = [] } = PersistenceModule.forRoot(configFor(driver));
        const bindings = providers.filter(
          (provider) =>
            (provider as { provide?: string }).provide === ORDER_REPOSITORY ||
            (provider as { provide?: string }).provide === STORE_HEALTH_INDICATOR,
        );
        expect(bindings).toHaveLength(2);
      }
    });

    it('defaults to reading process.env when no config is passed', () => {
      const original = process.env.NOSQL_DRIVER;
      process.env.NOSQL_DRIVER = 'mongodb';
      try {
        const { providers = [] } = PersistenceModule.forRoot();
        const binding = providers.find(
          (provider) => (provider as { provide?: string }).provide === ORDER_REPOSITORY,
        ) as { useClass: unknown };
        expect(binding.useClass).toBe(MongoOrderRepository);
      } finally {
        if (original === undefined) {
          delete process.env.NOSQL_DRIVER;
        } else {
          process.env.NOSQL_DRIVER = original;
        }
      }
    });
  });

  describe('driver provider sets', () => {
    it('the two sets bind the same tokens to different classes', () => {
      const tokenOf = (providers: unknown[], token: string): unknown =>
        (
          providers.find(
            (provider) => (provider as { provide?: string }).provide === token,
          ) as { useClass?: unknown }
        )?.useClass;

      const es = elasticsearchDriverProviders(configFor('elasticsearch'));
      const mongo = mongoDriverProviders(configFor('mongodb'));

      expect(tokenOf(es, ORDER_REPOSITORY)).toBe(ElasticsearchOrderRepository);
      expect(tokenOf(mongo, ORDER_REPOSITORY)).toBe(MongoOrderRepository);
      expect(tokenOf(es, STORE_HEALTH_INDICATOR)).toBe(ElasticsearchStoreHealthIndicator);
      expect(tokenOf(mongo, STORE_HEALTH_INDICATOR)).toBe(MongoStoreHealthIndicator);
    });
  });
});
