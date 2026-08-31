import { Client } from '@elastic/elasticsearch';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  Provider,
} from '@nestjs/common';

import { ElasticsearchConfig, NosqlDriver } from '../../config/configuration';
import { StoreHealth, StoreHealthIndicator } from '../order-repository.interface';

export const ELASTICSEARCH_CLIENT = 'ELASTICSEARCH_CLIENT';
export const ELASTICSEARCH_INDEX = 'ELASTICSEARCH_INDEX';

/** Builds the v8 client; basic auth is only attached when credentials are set. */
export function createElasticsearchClient(config: ElasticsearchConfig): Client {
  return new Client({
    node: config.node,
    ...(config.username
      ? { auth: { username: config.username, password: config.password ?? '' } }
      : {}),
    requestTimeout: 10_000,
    maxRetries: 3,
  });
}

/** The client + index name as DI providers, built from validated config. */
export function elasticsearchProviders(config: ElasticsearchConfig): Provider[] {
  return [
    { provide: ELASTICSEARCH_INDEX, useValue: config.index },
    {
      provide: ELASTICSEARCH_CLIENT,
      useFactory: (): Client => createElasticsearchClient(config),
    },
  ];
}

/**
 * Owns the client lifetime: closes the HTTP connection pool on shutdown so
 * SIGTERM (and Jest) are not held open by keep-alive sockets.
 */
@Injectable()
export class ElasticsearchConnection implements OnApplicationShutdown {
  private readonly logger = new Logger(ElasticsearchConnection.name);

  constructor(@Inject(ELASTICSEARCH_CLIENT) private readonly client: Client) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
    this.logger.log('Elasticsearch client closed');
  }
}

/** `GET /health` probe for the Elasticsearch driver. */
@Injectable()
export class ElasticsearchStoreHealthIndicator extends StoreHealthIndicator {
  readonly driver: NosqlDriver = 'elasticsearch';

  constructor(@Inject(ELASTICSEARCH_CLIENT) private readonly client: Client) {
    super();
  }

  async check(): Promise<StoreHealth> {
    try {
      await this.client.ping();
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
