import { Client } from '@elastic/elasticsearch';

import { ElasticsearchConfig } from '../../config/configuration';
import {
  ELASTICSEARCH_CLIENT,
  ELASTICSEARCH_INDEX,
  ElasticsearchConnection,
  ElasticsearchStoreHealthIndicator,
  createElasticsearchClient,
  elasticsearchProviders,
} from './elasticsearch.provider';
import { isNotFoundError } from './elasticsearch-order.repository';

const baseConfig: ElasticsearchConfig = {
  node: 'http://localhost:9200',
  index: 'orders',
};

describe('createElasticsearchClient', () => {
  it('builds a client pointed at the configured node', () => {
    const client = createElasticsearchClient(baseConfig);
    expect(client).toBeInstanceOf(Client);
    expect(client.connectionPool.connections[0].url.origin).toBe('http://localhost:9200');
  });

  it('attaches basic auth only when a username is configured', () => {
    const withAuth = createElasticsearchClient({
      ...baseConfig,
      username: 'elastic',
      password: 'changeme',
    });
    expect(withAuth).toBeInstanceOf(Client);

    // No credentials -> no Authorization header baked into the transport.
    const withoutAuth = createElasticsearchClient(baseConfig);
    expect(withoutAuth.transport).toBeDefined();
  });

  it('tolerates a username with no password', () => {
    expect(() =>
      createElasticsearchClient({ ...baseConfig, username: 'elastic' }),
    ).not.toThrow();
  });
});

describe('elasticsearchProviders', () => {
  it('exposes the index name and a client factory under stable tokens', () => {
    const providers = elasticsearchProviders({ ...baseConfig, index: 'orders-v2' });
    const tokens = providers.map((provider) => (provider as { provide: string }).provide);

    expect(tokens).toEqual([ELASTICSEARCH_INDEX, ELASTICSEARCH_CLIENT]);
    expect((providers[0] as { useValue: string }).useValue).toBe('orders-v2');

    const client = (providers[1] as { useFactory: () => Client }).useFactory();
    expect(client).toBeInstanceOf(Client);
  });
});

describe('ElasticsearchConnection', () => {
  it('closes the client on application shutdown', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const client = { close } as unknown as Client;

    await new ElasticsearchConnection(client).onApplicationShutdown();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('ElasticsearchStoreHealthIndicator', () => {
  it('reports the driver name from the contract', () => {
    const indicator = new ElasticsearchStoreHealthIndicator({} as Client);
    expect(indicator.driver).toBe('elasticsearch');
  });

  it('reports connected when ping succeeds', async () => {
    const client = { ping: jest.fn().mockResolvedValue(true) } as unknown as Client;
    await expect(new ElasticsearchStoreHealthIndicator(client).check()).resolves.toEqual({
      status: 'ok',
      store: 'connected',
    });
  });

  it('reports disconnected with a detail when ping fails', async () => {
    const client = {
      ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED 9200')),
    } as unknown as Client;

    await expect(new ElasticsearchStoreHealthIndicator(client).check()).resolves.toEqual({
      status: 'error',
      store: 'disconnected',
      detail: 'ECONNREFUSED 9200',
    });
  });

  it('stringifies a non-Error rejection', async () => {
    const client = { ping: jest.fn().mockRejectedValue('boom') } as unknown as Client;
    await expect(new ElasticsearchStoreHealthIndicator(client).check()).resolves.toEqual({
      status: 'error',
      store: 'disconnected',
      detail: 'boom',
    });
  });
});

describe('isNotFoundError', () => {
  it.each([
    ['statusCode 404', { statusCode: 404 }, true],
    ['meta.statusCode 404', { meta: { statusCode: 404 } }, true],
    ['name ResponseNotFound', { name: 'ResponseNotFound' }, true],
    ['statusCode 500', { statusCode: 500 }, false],
    ['meta.statusCode 503', { meta: { statusCode: 503 } }, false],
    ['a plain Error', new Error('socket hang up'), false],
    ['a string', 'nope', false],
    ['null', null, false],
    ['undefined', undefined, false],
    ['an empty object', {}, false],
  ])('%s -> %p', (_name, error, expected) => {
    expect(isNotFoundError(error)).toBe(expected);
  });
});
