import { Logger } from '@nestjs/common';
import { MongoClient } from 'mongodb';

import { MongoConfig } from '../../config/configuration';
import {
  MONGO_CLIENT,
  MongoConnection,
  MongoStoreHealthIndicator,
  ORDERS_COLLECTION,
  OrdersCollection,
  mongoProviders,
} from './mongo.provider';

const config: MongoConfig = {
  uri: 'mongodb://localhost:27017',
  database: 'orders',
  collection: 'orders',
  maxPoolSize: 17,
};

describe('mongoProviders', () => {
  it('registers the client and the collection under stable tokens', () => {
    const providers = mongoProviders(config);
    expect(providers.map((p) => (p as { provide: string }).provide)).toEqual([
      MONGO_CLIENT,
      ORDERS_COLLECTION,
    ]);
  });

  it('builds a single MongoClient with maxPoolSize from config', () => {
    const [clientProvider] = mongoProviders(config);
    const client = (clientProvider as { useFactory: () => MongoClient }).useFactory();

    expect(client).toBeInstanceOf(MongoClient);
    expect(client.options.maxPoolSize).toBe(17);
  });

  it('derives the collection from the configured database and collection names', () => {
    const [, collectionProvider] = mongoProviders({
      ...config,
      database: 'shop',
      collection: 'confirmed',
    });

    const collection = jest.fn().mockReturnValue('collection-handle');
    const db = jest.fn().mockReturnValue({ collection });
    const fakeClient = { db } as unknown as MongoClient;

    const result = (
      collectionProvider as { useFactory: (c: MongoClient) => unknown }
    ).useFactory(fakeClient);

    expect(db).toHaveBeenCalledWith('shop');
    expect(collection).toHaveBeenCalledWith('confirmed');
    expect(result).toBe('collection-handle');
    expect((collectionProvider as { inject: string[] }).inject).toEqual([MONGO_CLIENT]);
  });
});

describe('MongoConnection', () => {
  const createDoubles = () => {
    const connect = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const createIndexes = jest.fn().mockResolvedValue(['ok']);
    return {
      client: { connect, close } as unknown as MongoClient,
      collection: { createIndexes } as unknown as OrdersCollection,
      connect,
      close,
      createIndexes,
    };
  };

  it('connects and creates the access-pattern indexes on module init', async () => {
    const { client, collection, connect, createIndexes } = createDoubles();

    await new MongoConnection(client, collection).onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(createIndexes).toHaveBeenCalledWith([
      { key: { createdAt: -1 }, name: 'orders_createdAt_desc' },
      { key: { id: 1 }, name: 'orders_id_unique', unique: true },
      { key: { reference: 1 }, name: 'orders_reference' },
    ]);
  });

  it('creates the id index as unique', async () => {
    const { client, collection, createIndexes } = createDoubles();
    await new MongoConnection(client, collection).ensureIndexes();

    const specs = createIndexes.mock.calls[0][0] as { name: string; unique?: boolean }[];
    expect(specs.find((s) => s.name === 'orders_id_unique')?.unique).toBe(true);
  });

  it('does not crash the app when MongoDB is unreachable', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { collection } = createDoubles();
    const client = {
      connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED 27017')),
    } as unknown as MongoClient;

    await expect(
      new MongoConnection(client, collection).onModuleInit(),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  it('logs a non-Error rejection sensibly', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { collection } = createDoubles();
    const client = {
      connect: jest.fn().mockRejectedValue('boom'),
    } as unknown as MongoClient;

    await new MongoConnection(client, collection).onModuleInit();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  it('closes the client on application shutdown', async () => {
    const { client, collection, close } = createDoubles();
    await new MongoConnection(client, collection).onApplicationShutdown();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('MongoStoreHealthIndicator', () => {
  it('reports the driver name from the contract', () => {
    expect(new MongoStoreHealthIndicator({} as MongoClient).driver).toBe('mongodb');
  });

  it('reports connected when the ping command succeeds', async () => {
    const command = jest.fn().mockResolvedValue({ ok: 1 });
    const client = {
      db: jest.fn().mockReturnValue({ command }),
    } as unknown as MongoClient;

    await expect(new MongoStoreHealthIndicator(client).check()).resolves.toEqual({
      status: 'ok',
      store: 'connected',
    });
    expect(command).toHaveBeenCalledWith({ ping: 1 });
  });

  it('reports disconnected with a detail when the ping fails', async () => {
    const client = {
      db: jest.fn().mockReturnValue({
        command: jest.fn().mockRejectedValue(new Error('server selection timed out')),
      }),
    } as unknown as MongoClient;

    await expect(new MongoStoreHealthIndicator(client).check()).resolves.toEqual({
      status: 'error',
      store: 'disconnected',
      detail: 'server selection timed out',
    });
  });

  it('stringifies a non-Error rejection', async () => {
    const client = {
      db: jest.fn().mockReturnValue({
        command: jest.fn().mockRejectedValue('boom'),
      }),
    } as unknown as MongoClient;

    await expect(new MongoStoreHealthIndicator(client).check()).resolves.toMatchObject({
      detail: 'boom',
    });
  });
});
