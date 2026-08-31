import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { Client } from '@elastic/elasticsearch';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ELASTICSEARCH_CLIENT, ELASTICSEARCH_INDEX } from './elasticsearch.provider';

/** Shape of `infra/elasticsearch/orders.mapping.json`. */
export interface OrdersIndexDefinition {
  settings: Record<string, unknown>;
  mappings: Record<string, unknown>;
}

/** Path within the monorepo, relative to the repository root. */
export const ORDERS_MAPPING_RELATIVE_PATH = 'infra/elasticsearch/orders.mapping.json';

/**
 * ---------------------------------------------------------------------------
 * EMBEDDED FALLBACK — MUST BE KEPT IN SYNC WITH
 * `infra/elasticsearch/orders.mapping.json`
 * ---------------------------------------------------------------------------
 * The JSON file is the deliverable the assignment asks for and is the source of
 * truth. This constant is a byte-for-byte copy of it so the container still
 * bootstraps a correct index when the `infra/` folder is not mounted (the
 * production Docker image only ships `dist/` + `node_modules/`).
 *
 * `orders-mapping-sync.spec.ts` deep-equals the two and fails the build if they
 * ever drift, so "keep in sync" is enforced by CI rather than by good manners.
 */
export const EMBEDDED_ORDERS_INDEX_DEFINITION: OrdersIndexDefinition = {
  settings: {
    index: {
      number_of_shards: 1,
      number_of_replicas: 0,
      refresh_interval: '1s',
    },
    analysis: {
      normalizer: {
        lowercase_normalizer: {
          type: 'custom',
          char_filter: [],
          filter: ['lowercase', 'asciifolding'],
        },
      },
    },
  },
  mappings: {
    _meta: {
      application: 'orders-api',
      schemaVersion: 1,
      contract: 'docs/CONTRACT.md#3-orders-api--screen-2-persistence',
      description:
        'Confirmed shopping-list orders. One document per order; the cart lines live in the nested `items` field so that per-item queries do not cross-match across lines.',
    },
    dynamic: 'strict',
    properties: {
      id: { type: 'keyword' },
      reference: { type: 'keyword' },
      customer: {
        type: 'object',
        dynamic: 'strict',
        properties: {
          fullName: {
            type: 'text',
            fields: { keyword: { type: 'keyword', ignore_above: 256 } },
          },
          address: { type: 'text' },
          email: {
            type: 'keyword',
            normalizer: 'lowercase_normalizer',
            ignore_above: 256,
          },
        },
      },
      items: {
        type: 'nested',
        dynamic: 'strict',
        properties: {
          productId: { type: 'integer' },
          categoryId: { type: 'integer' },
          nameEn: {
            type: 'text',
            fields: { keyword: { type: 'keyword', ignore_above: 256 } },
          },
          nameHe: {
            type: 'text',
            fields: { keyword: { type: 'keyword', ignore_above: 256 } },
          },
          unit: { type: 'keyword' },
          quantity: { type: 'integer' },
          unitPrice: { type: 'scaled_float', scaling_factor: 100 },
          lineTotal: { type: 'scaled_float', scaling_factor: 100 },
        },
      },
      itemCount: { type: 'integer' },
      totalAmount: { type: 'scaled_float', scaling_factor: 100 },
      currency: { type: 'keyword' },
      locale: { type: 'keyword' },
      status: { type: 'keyword' },
      createdAt: { type: 'date' },
    },
  },
};

/**
 * Walks up from `startDir` looking for `infra/elasticsearch/orders.mapping.json`.
 *
 * This works from `src/` under ts-jest, from `dist/` after `nest build`, and
 * from `/app/dist` in the container when `infra/` is bind-mounted — without
 * hard-coding how many `..` segments deep the caller happens to be.
 * `ORDERS_MAPPING_PATH` short-circuits the search for exotic deployments.
 */
export function resolveOrdersMappingPath(
  startDir: string = __dirname,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const override = env.ORDERS_MAPPING_PATH;
  if (override && existsSync(override)) {
    return override;
  }

  let current = startDir;
  for (let depth = 0; depth < 10; depth++) {
    const candidate = resolve(current, ORDERS_MAPPING_RELATIVE_PATH);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

/**
 * Loads the index definition from disk, falling back to the embedded copy.
 * Never throws: an unreadable/corrupt file degrades to the constant.
 */
export function loadOrdersIndexDefinition(
  logger?: Logger,
  startDir: string = __dirname,
  env: NodeJS.ProcessEnv = process.env,
): { definition: OrdersIndexDefinition; source: 'file' | 'embedded'; path?: string } {
  const path = resolveOrdersMappingPath(startDir, env);
  if (path) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as OrdersIndexDefinition;
      if (parsed && typeof parsed === 'object' && parsed.mappings) {
        return { definition: parsed, source: 'file', path };
      }
      logger?.warn(`Mapping file at ${path} has no "mappings" key; using embedded copy.`);
    } catch (error) {
      logger?.warn(
        `Failed to read mapping file at ${path} (${
          error instanceof Error ? error.message : String(error)
        }); using embedded copy.`,
      );
    }
  }
  return { definition: EMBEDDED_ORDERS_INDEX_DEFINITION, source: 'embedded' };
}

/**
 * Creates the orders index on startup if it does not already exist.
 *
 * Deliberately non-fatal: a cold Elasticsearch container should not crash-loop
 * the API. When bootstrap fails, `GET /health` reports the store as
 * disconnected, which is the signal the contract asks for.
 */
@Injectable()
export class ElasticsearchIndexBootstrap implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchIndexBootstrap.name);

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly client: Client,
    @Inject(ELASTICSEARCH_INDEX) private readonly index: string,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureIndex();
    } catch (error) {
      this.logger.error(
        `Could not bootstrap index "${this.index}": ${
          error instanceof Error ? error.message : String(error)
        }. The API will start anyway; /health will report the store as disconnected.`,
      );
    }
  }

  /** @returns `true` when the index was created by this call. */
  async ensureIndex(): Promise<boolean> {
    const exists = await this.client.indices.exists({ index: this.index });
    if (exists) {
      this.logger.log(`Index "${this.index}" already exists`);
      return false;
    }

    const { definition, source, path } = loadOrdersIndexDefinition(this.logger);
    await this.client.indices.create({
      index: this.index,
      settings: definition.settings,
      mappings: definition.mappings,
    });
    this.logger.log(
      `Created index "${this.index}" from ${source} mapping${path ? ` (${path})` : ''}`,
    );
    return true;
  }
}
