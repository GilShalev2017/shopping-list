import { Client } from '@elastic/elasticsearch';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { Order } from '../../orders/entities/order.entity';
import { OrderDocument, OrderMapper } from '../../orders/mappers/order.mapper';
import {
  ListOrdersParams,
  OrderRepository,
  PaginatedResult,
} from '../order-repository.interface';
import { ELASTICSEARCH_CLIENT, ELASTICSEARCH_INDEX } from './elasticsearch.provider';

/**
 * Duck-typed 404 detection.
 *
 * Using `instanceof errors.ResponseError` would couple this adapter (and every
 * test that fakes the client) to the concrete class the transport happens to
 * throw. Both `error.statusCode` and `error.meta.statusCode` are checked
 * because the v8 client populates them in different code paths.
 */
export function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as {
    statusCode?: unknown;
    meta?: { statusCode?: unknown };
    name?: unknown;
  };
  return (
    candidate.statusCode === 404 ||
    candidate.meta?.statusCode === 404 ||
    candidate.name === 'ResponseNotFound'
  );
}

interface SearchTotal {
  value?: number;
}

/** Elasticsearch adapter for the {@link OrderRepository} port. */
@Injectable()
export class ElasticsearchOrderRepository extends OrderRepository {
  private readonly logger = new Logger(ElasticsearchOrderRepository.name);

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly client: Client,
    @Inject(ELASTICSEARCH_INDEX) private readonly index: string,
  ) {
    super();
  }

  /**
   * `refresh: 'wait_for'` makes the document visible to the very next search —
   * without it the confirmation screen (and the e2e suite) could POST an order
   * and then get an empty list back within the default 1s refresh interval.
   */
  async save(order: Order): Promise<Order> {
    const document = OrderMapper.toPersistence(order);
    await this.client.index({
      index: this.index,
      id: document.id,
      document,
      refresh: 'wait_for',
    });
    this.logger.log(`Indexed order ${document.reference} (${document.id})`);
    return OrderMapper.toDomain(document);
  }

  async findById(id: string): Promise<Order | null> {
    try {
      const response = await this.client.get<OrderDocument>({
        index: this.index,
        id,
      });
      return response._source ? OrderMapper.toDomain(response._source) : null;
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  async list({ limit, offset }: ListOrdersParams): Promise<PaginatedResult<Order>> {
    const response = await this.client.search<OrderDocument>({
      index: this.index,
      from: offset,
      size: limit,
      track_total_hits: true,
      query: { match_all: {} },
      sort: [{ createdAt: 'desc' }],
    });

    const rawTotal = response.hits.total as number | SearchTotal | undefined;
    const total = typeof rawTotal === 'number' ? rawTotal : (rawTotal?.value ?? 0);

    return {
      total,
      items: response.hits.hits
        .map((hit) => hit._source)
        .filter((source): source is OrderDocument => Boolean(source))
        .map((source) => OrderMapper.toDomain(source)),
    };
  }
}
