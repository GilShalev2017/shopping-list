import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
  Provider,
} from '@nestjs/common';
import { Collection, MongoClient } from 'mongodb';

import { MongoConfig, NosqlDriver } from '../../config/configuration';
import { OrderDocument } from '../../orders/mappers/order.mapper';
import { StoreHealth, StoreHealthIndicator } from '../order-repository.interface';

export const MONGO_CLIENT = 'MONGO_CLIENT';
export const ORDERS_COLLECTION = 'ORDERS_COLLECTION';

export type OrdersCollection = Collection<OrderDocument>;

/**
 * Providers for the MongoDB driver.
 *
 * The `MongoClient` is constructed once (it owns its own connection pool, so a
 * single instance per process is the documented usage) and the collection
 * handle is derived from it. `new MongoClient()` does not open a socket, so
 * building it in a factory is safe; `MongoConnection` performs the actual
 * `connect()` during `onModuleInit`.
 */
export function mongoProviders(config: MongoConfig): Provider[] {
  return [
    {
      provide: MONGO_CLIENT,
      useFactory: (): MongoClient =>
        new MongoClient(config.uri, {
          maxPoolSize: config.maxPoolSize,
          serverSelectionTimeoutMS: 5_000,
        }),
    },
    {
      provide: ORDERS_COLLECTION,
      useFactory: (client: MongoClient): OrdersCollection =>
        client.db(config.database).collection<OrderDocument>(config.collection),
      inject: [MONGO_CLIENT],
    },
  ];
}

/**
 * Owns the connection lifetime and the index set.
 *
 * Indexes mirror the access patterns of the contract: newest-first listing
 * (`createdAt` desc), lookup by id (unique — the id is server-generated and must
 * never repeat) and lookup by human reference.
 */
@Injectable()
export class MongoConnection implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MongoConnection.name);

  constructor(
    @Inject(MONGO_CLIENT) private readonly client: MongoClient,
    @Inject(ORDERS_COLLECTION) private readonly collection: OrdersCollection,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      await this.ensureIndexes();
      this.logger.log('MongoDB connected and indexes ensured');
    } catch (error) {
      // Non-fatal, mirroring the Elasticsearch bootstrap: /health reports it.
      this.logger.error(
        `MongoDB bootstrap failed: ${
          error instanceof Error ? error.message : String(error)
        }. The API will start anyway; /health will report the store as disconnected.`,
      );
    }
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndexes([
      { key: { createdAt: -1 }, name: 'orders_createdAt_desc' },
      { key: { id: 1 }, name: 'orders_id_unique', unique: true },
      { key: { reference: 1 }, name: 'orders_reference' },
    ]);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
    this.logger.log('MongoDB client closed');
  }
}

/** `GET /health` probe for the MongoDB driver. */
@Injectable()
export class MongoStoreHealthIndicator extends StoreHealthIndicator {
  readonly driver: NosqlDriver = 'mongodb';

  constructor(@Inject(MONGO_CLIENT) private readonly client: MongoClient) {
    super();
  }

  async check(): Promise<StoreHealth> {
    try {
      await this.client.db().command({ ping: 1 });
      return { status: 'ok', store: 'connected' };
    } catch (error) {
      return {
        status: 'error',
        store: 'disconnected',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
