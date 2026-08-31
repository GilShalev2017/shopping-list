import { Order } from '../src/orders/entities/order.entity';
import { OrderMapper } from '../src/orders/mappers/order.mapper';
import {
  ListOrdersParams,
  OrderRepository,
  PaginatedResult,
} from '../src/persistence/order-repository.interface';

/**
 * A third implementation of the port, used only by the e2e suite.
 *
 * That it can be dropped in with a one-line `overrideProvider` — and that the
 * HTTP-level assertions below are unchanged by it — is itself evidence that the
 * ports-and-adapters boundary is real.
 */
export class InMemoryOrderRepository extends OrderRepository {
  private readonly documents = new Map<string, unknown>();

  async save(order: Order): Promise<Order> {
    const document = OrderMapper.toPersistence(order);
    this.documents.set(document.id, JSON.parse(JSON.stringify(document)));
    return Promise.resolve(OrderMapper.toDomain(document));
  }

  findById(id: string): Promise<Order | null> {
    const document = this.documents.get(id);
    return Promise.resolve(document ? OrderMapper.toDomain(document) : null);
  }

  list({ limit, offset }: ListOrdersParams): Promise<PaginatedResult<Order>> {
    const all = [...this.documents.values()]
      .map((document) => OrderMapper.toDomain(document))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return Promise.resolve({
      total: all.length,
      items: all.slice(offset, offset + limit),
    });
  }

  clear(): void {
    this.documents.clear();
  }
}
