import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { Order } from '../orders/entities/order.entity';

/** A valid `POST /api/orders` body. Override anything via `patch`. */
export function validCreateOrderPayload(
  patch: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    customer: {
      fullName: 'ישראל ישראלי',
      address: 'הרצל 10, תל אביב',
      email: 'israel@example.com',
    },
    items: [
      {
        productId: 101,
        categoryId: 1,
        nameEn: 'Milk 3%',
        nameHe: 'חלב 3%',
        unit: 'carton',
        quantity: 2,
        unitPrice: 6.9,
      },
    ],
    locale: 'he',
    ...patch,
  };
}

export function createOrderDto(patch: Partial<CreateOrderDto> = {}): CreateOrderDto {
  return {
    customer: {
      fullName: 'ישראל ישראלי',
      address: 'הרצל 10, תל אביב',
      email: 'israel@example.com',
    },
    items: [
      {
        productId: 101,
        categoryId: 1,
        nameEn: 'Milk 3%',
        nameHe: 'חלב 3%',
        unit: 'carton',
        quantity: 2,
        unitPrice: 6.9,
      },
    ],
    locale: 'he',
    ...patch,
  } as CreateOrderDto;
}

/** A fully-computed order, as it would exist after `OrdersService.create()`. */
export function orderFixture(patch: Partial<Order> = {}): Order {
  return {
    id: '01J8ZK9X7QF3M2N4P5R6S7T8V9',
    reference: 'ORD-8F3A21',
    customer: {
      fullName: 'ישראל ישראלי',
      address: 'הרצל 10, תל אביב',
      email: 'israel@example.com',
    },
    items: [
      {
        productId: 101,
        categoryId: 1,
        nameEn: 'Milk 3%',
        nameHe: 'חלב 3%',
        unit: 'carton',
        quantity: 2,
        unitPrice: 6.9,
        lineTotal: 13.8,
      },
    ],
    itemCount: 2,
    totalAmount: 13.8,
    currency: 'ILS',
    locale: 'he',
    status: 'confirmed',
    createdAt: '2026-08-31T12:00:00.000Z',
    ...patch,
  };
}
