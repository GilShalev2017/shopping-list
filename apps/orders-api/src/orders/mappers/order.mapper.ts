import {
  Order,
  OrderCurrency,
  OrderCustomer,
  OrderItem,
  OrderLocale,
  OrderStatus,
  ORDER_CURRENCY,
  ORDER_STATUS_CONFIRMED,
} from '../entities/order.entity';
import { round2 } from '../../common/money.util';

/**
 * The document shape written to (and read back from) the NoSQL store.
 *
 * It is intentionally identical to {@link Order}: both adapters store the same
 * JSON, which is what makes the Elasticsearch <-> MongoDB swap observable only
 * through configuration. Elasticsearch additionally uses `id` as the `_id`;
 * MongoDB keeps its own `_id` and projects it away on read.
 */
export interface OrderDocument {
  id: string;
  reference: string;
  customer: OrderCustomer;
  items: OrderItem[];
  itemCount: number;
  totalAmount: number;
  currency: string;
  locale: string;
  status: string;
  createdAt: string;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDomainItem(raw: unknown): OrderItem {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    productId: Math.trunc(asNumber(source.productId)),
    categoryId: Math.trunc(asNumber(source.categoryId)),
    nameEn: asString(source.nameEn),
    nameHe: asString(source.nameHe),
    unit: asString(source.unit),
    quantity: Math.trunc(asNumber(source.quantity)),
    unitPrice: round2(asNumber(source.unitPrice)),
    lineTotal: round2(asNumber(source.lineTotal)),
  };
}

export const OrderMapper = {
  /**
   * Domain -> storage. Produces a plain, JSON-safe object with a stable key
   * order and no extra fields (the Elasticsearch mapping is `dynamic: strict`,
   * so a stray field would be rejected by the cluster).
   */
  toPersistence(order: Order): OrderDocument {
    return {
      id: order.id,
      reference: order.reference,
      customer: {
        fullName: order.customer.fullName,
        address: order.customer.address,
        email: order.customer.email,
      },
      items: order.items.map((item) => ({
        productId: item.productId,
        categoryId: item.categoryId,
        nameEn: item.nameEn,
        nameHe: item.nameHe,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: round2(item.unitPrice),
        lineTotal: round2(item.lineTotal),
      })),
      itemCount: order.itemCount,
      totalAmount: round2(order.totalAmount),
      currency: order.currency,
      locale: order.locale,
      status: order.status,
      createdAt: order.createdAt,
    };
  },

  /**
   * Storage -> domain. Defensive on purpose: `_source` from Elasticsearch and
   * a BSON document from MongoDB are both `unknown` as far as the compiler is
   * concerned, and scaled_float can hand back a value that lost its type.
   */
  toDomain(raw: unknown): Order {
    const source = (raw ?? {}) as Record<string, unknown>;
    const customer = (source.customer ?? {}) as Record<string, unknown>;
    const items = Array.isArray(source.items) ? source.items : [];

    return {
      id: asString(source.id),
      reference: asString(source.reference),
      customer: {
        fullName: asString(customer.fullName),
        address: asString(customer.address),
        email: asString(customer.email),
      },
      items: items.map(toDomainItem),
      itemCount: Math.trunc(asNumber(source.itemCount)),
      totalAmount: round2(asNumber(source.totalAmount)),
      currency: asString(source.currency, ORDER_CURRENCY) as OrderCurrency,
      locale: asString(source.locale, 'he') as OrderLocale,
      status: asString(source.status, ORDER_STATUS_CONFIRMED) as OrderStatus,
      createdAt: asString(source.createdAt),
    };
  },
};
