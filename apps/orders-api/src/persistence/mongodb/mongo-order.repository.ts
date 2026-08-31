import { Inject, Injectable, Logger } from '@nestjs/common';

import { Order } from '../../orders/entities/order.entity';
import { OrderMapper } from '../../orders/mappers/order.mapper';
import {
  ListOrdersParams,
  OrderRepository,
  PaginatedResult,
} from '../order-repository.interface';
import { ORDERS_COLLECTION, OrdersCollection } from './mongo.provider';

/** Mongo's own `_id` never leaves the adapter — the domain id is `id`. */
const WITHOUT_MONGO_ID = { _id: 0 } as const;

/**
 * MongoDB adapter for the {@link OrderRepository} port.
 *
 * Uses the official driver rather than Mongoose on purpose: the document shape
 * is already defined once by `OrderMapper`/the Elasticsearch mapping, and a
 * second (Mongoose) schema would be a third place for it to drift. It also
 * keeps this adapter structurally symmetric with the Elasticsearch one.
 */
@Injectable()
export class MongoOrderRepository extends OrderRepository {
  private readonly logger = new Logger(MongoOrderRepository.name);

  constructor(@Inject(ORDERS_COLLECTION) private readonly collection: OrdersCollection) {
    super();
  }

  async save(order: Order): Promise<Order> {
    const document = OrderMapper.toPersistence(order);
    await this.collection.insertOne({ ...document });
    this.logger.log(`Inserted order ${document.reference} (${document.id})`);
    return OrderMapper.toDomain(document);
  }

  async findById(id: string): Promise<Order | null> {
    const document = await this.collection.findOne(
      { id },
      { projection: WITHOUT_MONGO_ID },
    );
    return document ? OrderMapper.toDomain(document) : null;
  }

  async list({ limit, offset }: ListOrdersParams): Promise<PaginatedResult<Order>> {
    const [total, documents] = await Promise.all([
      this.collection.countDocuments({}),
      this.collection
        .find({}, { projection: WITHOUT_MONGO_ID })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
    ]);

    return {
      total,
      items: documents.map((document) => OrderMapper.toDomain(document)),
    };
  }
}
