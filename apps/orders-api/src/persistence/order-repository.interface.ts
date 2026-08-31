import { Order } from '../orders/entities/order.entity';
import { NosqlDriver } from '../config/configuration';

/** DI token bound to exactly one adapter by `PersistenceModule.forRoot()`. */
export const ORDER_REPOSITORY = 'ORDER_REPOSITORY';

/** DI token for the per-driver health probe used by `GET /health`. */
export const STORE_HEALTH_INDICATOR = 'STORE_HEALTH_INDICATOR';

export interface ListOrdersParams {
  readonly limit: number;
  readonly offset: number;
}

export interface PaginatedResult<T> {
  readonly total: number;
  readonly items: T[];
}

/**
 * The **port**. `OrdersService` depends on this abstraction and on nothing else
 * from the persistence layer — it has no idea whether an Elasticsearch cluster
 * or a MongoDB replica set is answering.
 *
 * Declared as an `abstract class` rather than an `interface` so it survives to
 * runtime and can double as a Nest provider type; the string token above is
 * what the dynamic module actually binds, which keeps the swap explicit.
 */
export abstract class OrderRepository {
  /** Persists a fully-computed order and returns it as stored. */
  abstract save(order: Order): Promise<Order>;

  /** Returns the order, or `null` when it does not exist. */
  abstract findById(id: string): Promise<Order | null>;

  /** Newest first, paginated. `total` is the full match count, not the page size. */
  abstract list(params: ListOrdersParams): Promise<PaginatedResult<Order>>;
}

export interface StoreHealth {
  readonly status: 'ok' | 'error';
  readonly store: 'connected' | 'disconnected';
  readonly detail?: string;
}

/**
 * The second port: a liveness probe for whichever store is wired in, so
 * `GET /health` can answer with the shape from `docs/CONTRACT.md` §3.
 */
export abstract class StoreHealthIndicator {
  /** Reported verbatim as the `driver` field of the health response. */
  abstract readonly driver: NosqlDriver;

  abstract check(): Promise<StoreHealth>;
}
