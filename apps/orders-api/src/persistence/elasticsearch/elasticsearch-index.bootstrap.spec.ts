import { readFileSync } from 'node:fs';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

import type { Client } from '@elastic/elasticsearch';
import { Logger } from '@nestjs/common';

import {
  EMBEDDED_ORDERS_INDEX_DEFINITION,
  ElasticsearchIndexBootstrap,
  ORDERS_MAPPING_RELATIVE_PATH,
  loadOrdersIndexDefinition,
  resolveOrdersMappingPath,
} from './elasticsearch-index.bootstrap';

const INDEX = 'orders-test';

// ORDERS_MAPPING_RELATIVE_PATH is POSIX-style; resolve() returns
// backslash-joined paths on Windows, so compare with slashes normalised.
const toPosix = (value: string): string => value.split(sep).join('/');

function createClient(overrides: { exists?: jest.Mock; create?: jest.Mock }): {
  client: Client;
  exists: jest.Mock;
  create: jest.Mock;
} {
  const exists = overrides.exists ?? jest.fn().mockResolvedValue(false);
  const create = overrides.create ?? jest.fn().mockResolvedValue({ acknowledged: true });
  return {
    client: { indices: { exists, create } } as unknown as Client,
    exists,
    create,
  };
}

describe('ElasticsearchIndexBootstrap', () => {
  describe('ensureIndex — create-if-absent', () => {
    it('creates the index with the mapping when it does not exist', async () => {
      const { client, exists, create } = createClient({
        exists: jest.fn().mockResolvedValue(false),
      });

      const bootstrap = new ElasticsearchIndexBootstrap(client, INDEX);
      await expect(bootstrap.ensureIndex()).resolves.toBe(true);

      expect(exists).toHaveBeenCalledWith({ index: INDEX });
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({
        index: INDEX,
        settings: EMBEDDED_ORDERS_INDEX_DEFINITION.settings,
        mappings: EMBEDDED_ORDERS_INDEX_DEFINITION.mappings,
      });
    });

    it('does nothing when the index already exists', async () => {
      const { client, exists, create } = createClient({
        exists: jest.fn().mockResolvedValue(true),
      });

      const bootstrap = new ElasticsearchIndexBootstrap(client, INDEX);
      await expect(bootstrap.ensureIndex()).resolves.toBe(false);

      expect(exists).toHaveBeenCalledWith({ index: INDEX });
      expect(create).not.toHaveBeenCalled();
    });

    it('propagates a create failure to the caller', async () => {
      const { client } = createClient({
        exists: jest.fn().mockResolvedValue(false),
        create: jest.fn().mockRejectedValue(new Error('cluster_block_exception')),
      });

      await expect(
        new ElasticsearchIndexBootstrap(client, INDEX).ensureIndex(),
      ).rejects.toThrow('cluster_block_exception');
    });
  });

  describe('onModuleInit', () => {
    it('bootstraps the index on startup', async () => {
      const { client, create } = createClient({
        exists: jest.fn().mockResolvedValue(false),
      });

      await new ElasticsearchIndexBootstrap(client, INDEX).onModuleInit();
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('never crashes the app when Elasticsearch is unreachable', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const { client } = createClient({
        exists: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      });

      await expect(
        new ElasticsearchIndexBootstrap(client, INDEX).onModuleInit(),
      ).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
    });

    it('logs a non-Error rejection sensibly', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const { client } = createClient({
        exists: jest.fn().mockRejectedValue('boom'),
      });

      await new ElasticsearchIndexBootstrap(client, INDEX).onModuleInit();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
    });
  });
});

describe('resolveOrdersMappingPath', () => {
  it('finds infra/elasticsearch/orders.mapping.json by walking up from src/', () => {
    const path = resolveOrdersMappingPath(__dirname, {});
    expect(path).not.toBeNull();
    expect(toPosix(path as string)).toContain(ORDERS_MAPPING_RELATIVE_PATH);
  });

  it('honours ORDERS_MAPPING_PATH when the file exists', () => {
    const real = resolveOrdersMappingPath(__dirname, {}) as string;
    expect(resolveOrdersMappingPath('/', { ORDERS_MAPPING_PATH: real })).toBe(real);
  });

  it('ignores ORDERS_MAPPING_PATH when the file does not exist', () => {
    const path = resolveOrdersMappingPath(__dirname, {
      ORDERS_MAPPING_PATH: '/nowhere/orders.mapping.json',
    });
    expect(toPosix(path as string)).toContain(ORDERS_MAPPING_RELATIVE_PATH);
  });

  it('returns null when nothing is found up the tree', () => {
    const empty = mkdtempSync(join(tmpdir(), 'orders-mapping-'));
    expect(resolveOrdersMappingPath(empty, {})).toBeNull();
  });

  it('stops at the filesystem root instead of looping', () => {
    expect(resolveOrdersMappingPath('/', {})).toBeNull();
  });

  it('defaults to __dirname and process.env when called with no arguments', () => {
    expect(toPosix(resolveOrdersMappingPath() as string)).toContain(
      ORDERS_MAPPING_RELATIVE_PATH,
    );
  });
});

describe('loadOrdersIndexDefinition', () => {
  it('prefers the on-disk mapping file', () => {
    const { definition, source, path } = loadOrdersIndexDefinition(
      undefined,
      __dirname,
      {},
    );

    expect(source).toBe('file');
    expect(toPosix(path as string)).toContain(ORDERS_MAPPING_RELATIVE_PATH);
    expect(definition).toEqual(
      JSON.parse(readFileSync(path as string, 'utf8')) as unknown,
    );
  });

  it('falls back to the embedded copy when the file is absent', () => {
    const empty = mkdtempSync(join(tmpdir(), 'orders-mapping-'));
    const { definition, source, path } = loadOrdersIndexDefinition(undefined, empty, {});

    expect(source).toBe('embedded');
    expect(path).toBeUndefined();
    expect(definition).toBe(EMBEDDED_ORDERS_INDEX_DEFINITION);
  });

  it('falls back to the embedded copy when the file is corrupt', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orders-mapping-'));
    const file = join(dir, 'broken.json');
    writeFileSync(file, '{ not json');
    const logger = { warn: jest.fn() } as unknown as Logger;

    const { definition, source } = loadOrdersIndexDefinition(logger, dir, {
      ORDERS_MAPPING_PATH: file,
    });

    expect(source).toBe('embedded');
    expect(definition).toBe(EMBEDDED_ORDERS_INDEX_DEFINITION);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to read'));
  });

  it('stringifies a non-Error read failure', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orders-mapping-'));
    const file = join(dir, 'exists.json');
    writeFileSync(file, '{}');
    const logger = { warn: jest.fn() } as unknown as Logger;

    const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw 'EACCES';
    });

    try {
      const { source } = loadOrdersIndexDefinition(logger, dir, {
        ORDERS_MAPPING_PATH: file,
      });
      expect(source).toBe('embedded');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('EACCES'));
    } finally {
      spy.mockRestore();
    }
  });

  it('falls back silently when no logger was supplied', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orders-mapping-'));
    const file = join(dir, 'broken.json');
    writeFileSync(file, '{ not json');

    const { source } = loadOrdersIndexDefinition(undefined, dir, {
      ORDERS_MAPPING_PATH: file,
    });
    expect(source).toBe('embedded');
  });

  it('falls back when the file parses but has no "mappings" key', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orders-mapping-'));
    const file = join(dir, 'incomplete.json');
    writeFileSync(file, JSON.stringify({ settings: {} }));
    const logger = { warn: jest.fn() } as unknown as Logger;

    const { definition, source } = loadOrdersIndexDefinition(logger, dir, {
      ORDERS_MAPPING_PATH: file,
    });

    expect(source).toBe('embedded');
    expect(definition).toBe(EMBEDDED_ORDERS_INDEX_DEFINITION);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('has no "mappings" key'),
    );
  });

  it('loads a mapping discovered by walking up, not only via the override', () => {
    const root = mkdtempSync(join(tmpdir(), 'orders-monorepo-'));
    const deep = resolve(root, 'apps/orders-api/dist/persistence/elasticsearch');
    mkdirSync(deep, { recursive: true });
    mkdirSync(resolve(root, 'infra/elasticsearch'), { recursive: true });
    writeFileSync(
      resolve(root, ORDERS_MAPPING_RELATIVE_PATH),
      JSON.stringify({ settings: { index: {} }, mappings: { dynamic: 'strict' } }),
    );

    const { definition, source } = loadOrdersIndexDefinition(undefined, deep, {});
    expect(source).toBe('file');
    expect(definition.mappings).toEqual({ dynamic: 'strict' });
  });
});
