import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { orderReference, ulid } from '../common/id.util';
import { round2, sumMoney } from '../common/money.util';
import {
  ListOrdersParams,
  OrderRepository,
  ORDER_REPOSITORY,
  PaginatedResult,
} from '../persistence/order-repository.interface';
import { CreateOrderDto, DEFAULT_ORDER_LOCALE } from './dto/create-order.dto';
import { OrderItemDto } from './dto/order-item.dto';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import {
  Order,
  OrderItem,
  ORDER_CURRENCY,
  ORDER_STATUS_CONFIRMED,
} from './entities/order.entity';

/**
 * Order use-cases.
 *
 * Depends only on the {@link OrderRepository} port — it has no import from
 * `persistence/elasticsearch` or `persistence/mongodb`, which is what makes the
 * driver genuinely swappable.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(@Inject(ORDER_REPOSITORY) private readonly repository: OrderRepository) {}

  /**
   * Builds the confirmed order.
   *
   * Client-supplied totals are ignored entirely: `lineTotal`, `itemCount` and
   * `totalAmount` are all derived here from `quantity` and `unitPrice`, so a
   * tampered payload cannot change what is stored or charged.
   */
  async create(dto: CreateOrderDto): Promise<Order> {
    const items: OrderItem[] = dto.items.map((item) => this.toOrderItem(item));

    const order: Order = {
      id: ulid(),
      reference: orderReference(),
      customer: {
        fullName: dto.customer.fullName,
        address: dto.customer.address,
        email: dto.customer.email,
      },
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      totalAmount: sumMoney(items.map((item) => item.lineTotal)),
      currency: ORDER_CURRENCY,
      locale: dto.locale ?? DEFAULT_ORDER_LOCALE,
      status: ORDER_STATUS_CONFIRMED,
      createdAt: new Date().toISOString(),
    };

    const saved = await this.repository.save(order);
    this.logger.log(
      `Order ${saved.reference} confirmed: ${saved.itemCount} item(s), ${saved.totalAmount} ${saved.currency}`,
    );
    return saved;
  }

  /** @throws NotFoundException when the store has no such order. */
  async findOne(id: string): Promise<Order> {
    const order = await this.repository.findById(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }
    return order;
  }

  /** Newest first. Pagination is passed straight through to the adapter. */
  async findAll(query: ListOrdersQueryDto): Promise<PaginatedResult<Order>> {
    const params: ListOrdersParams = {
      limit: query.limit,
      offset: query.offset,
    };
    return this.repository.list(params);
  }

  private toOrderItem(item: OrderItemDto): OrderItem {
    return {
      productId: item.productId,
      categoryId: item.categoryId,
      nameEn: item.nameEn,
      nameHe: item.nameHe,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: round2(item.unitPrice),
      lineTotal: round2(item.quantity * item.unitPrice),
    };
  }
}
