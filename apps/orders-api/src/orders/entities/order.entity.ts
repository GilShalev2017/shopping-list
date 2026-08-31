import { ApiProperty } from '@nestjs/swagger';

export const ORDER_CURRENCY = 'ILS';
export const ORDER_STATUS_CONFIRMED = 'confirmed';

export type OrderCurrency = typeof ORDER_CURRENCY;
export type OrderStatus = typeof ORDER_STATUS_CONFIRMED;
export type OrderLocale = 'he' | 'en';

/**
 * The persisted domain model (`docs/CONTRACT.md` §3).
 *
 * Declared as classes rather than interfaces so a single definition serves both
 * as the TypeScript type *and* as the OpenAPI response schema — no duplicated
 * "response DTO" that can drift from the domain object. They carry no methods,
 * so structural typing lets adapters return plain object literals.
 */
export class OrderCustomer {
  @ApiProperty({ example: 'ישראל ישראלי' })
  fullName: string;

  @ApiProperty({ example: 'הרצל 10, תל אביב' })
  address: string;

  @ApiProperty({ example: 'israel@example.com' })
  email: string;
}

export class OrderItem {
  @ApiProperty({ example: 101 })
  productId: number;

  @ApiProperty({ example: 1 })
  categoryId: number;

  @ApiProperty({ example: 'Milk 3%' })
  nameEn: string;

  @ApiProperty({ example: 'חלב 3%' })
  nameHe: string;

  @ApiProperty({ example: 'carton' })
  unit: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 6.9 })
  unitPrice: number;

  @ApiProperty({
    example: 13.8,
    description: 'Server-computed: quantity * unitPrice, rounded to 2 decimals.',
  })
  lineTotal: number;
}

export class Order {
  @ApiProperty({ example: '01J8ZK9X7QF3M2N4P5R6S7T8V9' })
  id: string;

  @ApiProperty({ example: 'ORD-8F3A21' })
  reference: string;

  @ApiProperty({ type: OrderCustomer })
  customer: OrderCustomer;

  @ApiProperty({ type: [OrderItem] })
  items: OrderItem[];

  @ApiProperty({ example: 2, description: 'Sum of item quantities.' })
  itemCount: number;

  @ApiProperty({ example: 13.8, description: 'Sum of line totals.' })
  totalAmount: number;

  @ApiProperty({ example: ORDER_CURRENCY, enum: [ORDER_CURRENCY] })
  currency: OrderCurrency;

  @ApiProperty({ example: 'he', enum: ['he', 'en'] })
  locale: OrderLocale;

  @ApiProperty({ example: ORDER_STATUS_CONFIRMED, enum: [ORDER_STATUS_CONFIRMED] })
  status: OrderStatus;

  @ApiProperty({ example: '2026-08-31T12:00:00.000Z', format: 'date-time' })
  createdAt: string;
}

/** Envelope returned by `GET /api/orders`. */
export class PaginatedOrders {
  @ApiProperty({ example: 42, description: 'Total matching orders in the store.' })
  total: number;

  @ApiProperty({ type: [Order] })
  items: Order[];
}
