import { DynamicModule, Logger, Module, Provider } from '@nestjs/common';

import { AppConfig, buildConfig } from '../config/configuration';
import { ORDER_REPOSITORY, STORE_HEALTH_INDICATOR } from './order-repository.interface';
import { ElasticsearchIndexBootstrap } from './elasticsearch/elasticsearch-index.bootstrap';
import { ElasticsearchOrderRepository } from './elasticsearch/elasticsearch-order.repository';
import {
  ElasticsearchConnection,
  ElasticsearchStoreHealthIndicator,
  elasticsearchProviders,
} from './elasticsearch/elasticsearch.provider';
import { MongoOrderRepository } from './mongodb/mongo-order.repository';
import {
  MongoConnection,
  MongoStoreHealthIndicator,
  mongoProviders,
} from './mongodb/mongo.provider';

/**
 * Everything the Elasticsearch driver needs, as a single unit:
 * client + index name, the index bootstrap, the repository bound to the port
 * token, the health probe and the shutdown hook.
 */
export function elasticsearchDriverProviders(config: AppConfig): Provider[] {
  return [
    ...elasticsearchProviders(config.elasticsearch),
    ElasticsearchIndexBootstrap,
    ElasticsearchConnection,
    { provide: ORDER_REPOSITORY, useClass: ElasticsearchOrderRepository },
    { provide: STORE_HEALTH_INDICATOR, useClass: ElasticsearchStoreHealthIndicator },
  ];
}

/** The MongoDB equivalent — same tokens, different implementations. */
export function mongoDriverProviders(config: AppConfig): Provider[] {
  return [
    ...mongoProviders(config.mongodb),
    MongoConnection,
    { provide: ORDER_REPOSITORY, useClass: MongoOrderRepository },
    { provide: STORE_HEALTH_INDICATOR, useClass: MongoStoreHealthIndicator },
  ];
}

/**
 * The **adapter selector**.
 *
 * `forRoot()` reads the validated configuration once at composition time and
 * registers exactly one driver's providers. `ORDER_REPOSITORY` and
 * `STORE_HEALTH_INDICATOR` are therefore bound exactly once, and nothing
 * downstream (`OrdersService`, `HealthController`) can tell which store is live.
 *
 * Adding a third driver means adding a `*DriverProviders()` function and one
 * `case` below — no changes anywhere else in the application.
 *
 * Marked `global` so the two consumer modules do not each have to re-run
 * `forRoot()` (which would build a second client).
 */
@Module({})
export class PersistenceModule {
  private static readonly logger = new Logger(PersistenceModule.name);

  static forRoot(config: AppConfig = buildConfig()): DynamicModule {
    const providers =
      config.nosqlDriver === 'mongodb'
        ? mongoDriverProviders(config)
        : elasticsearchDriverProviders(config);

    PersistenceModule.logger.log(
      `NoSQL driver: ${config.nosqlDriver} -> ${
        config.nosqlDriver === 'mongodb'
          ? `${config.mongodb.uri}/${config.mongodb.database}.${config.mongodb.collection}`
          : `${config.elasticsearch.node} index "${config.elasticsearch.index}"`
      }`,
    );

    return {
      module: PersistenceModule,
      global: true,
      providers,
      exports: [ORDER_REPOSITORY, STORE_HEALTH_INDICATOR],
    };
  }
}
