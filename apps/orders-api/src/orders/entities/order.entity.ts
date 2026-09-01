import { ApiProperty } from '@nestjs/swagger';

export const ORDER_CURRENCY = 'ILS';
export const ORDER_STATUS_CONFIRMED = 'confirmed';

export type OrderCurrency = typeof ORDER_CURRENCY;
export type OrderStatus = typeof ORDER_STATUS_CONFIRMED;
export type OrderLocale = 'he' | 'en';

/**
 * The persisted domain model (`docs/CONTRACT.md` §3) — and, at the same time,
 * the documented response schema for every `Order`-shaped body.
 *
 * Declared as classes rather than interfaces so a single definition serves both
 * as the TypeScript type *and* as the OpenAPI schema: a parallel set of
 * "response DTOs" would be a second place for the shape to live and a second
 * place for it to drift. They carry no methods and no constructor, so
 * structural typing lets the adapters keep returning plain object literals —
 * nothing is instantiated, mapped or serialised on the way out, and the wire
 * format is exactly what the repository returned.
 */
export class OrderCustomer {
  @ApiProperty({
    description: 'Full name exactly as typed on screen 2, trimmed.',
    example: 'ישראל ישראלי',
    minLength: 2,
    maxLength: 120,
  })
  fullName: string;

  @ApiProperty({
    description: 'Free-text delivery address, trimmed.',
    example: 'הרצל 10, תל אביב',
    minLength: 5,
    maxLength: 250,
  })
  address: string;

  @ApiProperty({
    description: 'Contact e-mail the confirmation would be sent to.',
    example: 'israel@example.com',
    format: 'email',
    maxLength: 200,
  })
  email: string;
}

/**
 * A stored cart line: everything the client posted, plus the one field the
 * server adds.
 */
export class OrderItem {
  @ApiProperty({
    description: 'Catalog product id, as posted.',
    example: 101,
    type: 'integer',
    minimum: 1,
  })
  productId: number;

  @ApiProperty({
    description: 'Catalog category id, as posted.',
    example: 1,
    type: 'integer',
    minimum: 1,
  })
  categoryId: number;

  @ApiProperty({
    description: 'English product name, snapshotted at checkout time.',
    example: 'Milk 3%',
  })
  nameEn: string;

  @ApiProperty({
    description: 'Hebrew product name, snapshotted at checkout time.',
    example: 'חלב 3%',
  })
  nameHe: string;

  @ApiProperty({
    description: 'Catalog unit of measure (`unit`, `kg`, `pack`, `bottle`, `carton`).',
    example: 'carton',
  })
  unit: string;

  @ApiProperty({
    description: 'Quantity ordered.',
    example: 2,
    type: 'integer',
    minimum: 1,
    maximum: 999,
  })
  quantity: number;

  @ApiProperty({
    description: 'Unit price in ILS, re-rounded to 2 decimals by the server.',
    example: 6.9,
    type: 'number',
    format: 'double',
    minimum: 0,
  })
  unitPrice: number;

  @ApiProperty({
    description:
      '**Server-computed**, never accepted from the client: ' +
      '`round2(quantity × unitPrice)`. A request that carries this field is ' +
      'rejected with `400`.',
    example: 13.8,
    type: 'number',
    format: 'double',
    minimum: 0,
    readOnly: true,
  })
  lineTotal: number;
}

/** A confirmed order, exactly as stored and as returned by all three routes. */
export class Order {
  @ApiProperty({
    description:
      'Server-generated ULID: a 48-bit millisecond timestamp plus 80 bits of ' +
      'randomness, Crockford base32. Lexicographically sortable by creation ' +
      'time, which is why it doubles as the Elasticsearch `_id`.',
    example: '01J8ZK9X7QF3M2N4P5R6S7T8V9',
    minLength: 26,
    maxLength: 26,
    pattern: '^[0-9A-HJKMNP-TV-Z]{26}$',
    readOnly: true,
  })
  id: string;

  @ApiProperty({
    description:
      'Short human-facing reference shown on the confirmation screen: `ORD-` ' +
      'plus 6 uppercase hex characters. Meant to be read aloud on the phone; ' +
      'use `id` for lookups.',
    example: 'ORD-8F3A21',
    pattern: '^ORD-[0-9A-F]{6}$',
    readOnly: true,
  })
  reference: string;

  @ApiProperty({
    description: 'The delivery details, echoed back as stored.',
    type: OrderCustomer,
  })
  customer: OrderCustomer;

  @ApiProperty({
    description: 'The cart as stored, each line carrying its computed `lineTotal`.',
    type: [OrderItem],
    minItems: 1,
    maxItems: 100,
  })
  items: OrderItem[];

  @ApiProperty({
    description:
      'Server-computed sum of `quantity` across all lines (not the line count).',
    example: 2,
    type: 'integer',
    minimum: 1,
    readOnly: true,
  })
  itemCount: number;

  @ApiProperty({
    description:
      'Server-computed order total: `round2(Σ lineTotal)`. Summed in agorot so ' +
      'a hundred-line cart cannot accumulate binary-float drift.',
    example: 13.8,
    type: 'number',
    format: 'double',
    minimum: 0,
    readOnly: true,
  })
  totalAmount: number;

  @ApiProperty({
    description: 'Always `ILS`. The catalog prices are shekels; no conversion happens.',
    example: ORDER_CURRENCY,
    enum: [ORDER_CURRENCY],
    readOnly: true,
  })
  currency: OrderCurrency;

  @ApiProperty({
    description: 'The locale the order was placed in, defaulting to `he`.',
    example: 'he',
    enum: ['he', 'en'],
    enumName: 'OrderLocale',
  })
  locale: OrderLocale;

  @ApiProperty({
    description:
      'Always `confirmed`. The assignment has no fulfilment workflow, so the ' +
      'field exists to make the document self-describing (and to leave room for ' +
      '`cancelled` / `shipped` later) rather than to model a state machine.',
    example: ORDER_STATUS_CONFIRMED,
    enum: [ORDER_STATUS_CONFIRMED],
    readOnly: true,
  })
  status: OrderStatus;

  @ApiProperty({
    description: 'Server-generated ISO-8601 UTC timestamp with milliseconds.',
    example: '2026-08-31T12:00:00.000Z',
    format: 'date-time',
    readOnly: true,
  })
  createdAt: string;
}

/**
 * Envelope returned by `GET /api/orders`.
 *
 * `total` is the full match count in the store, not the length of `items`,
 * which is what lets a client render "showing 20 of 137" without a second call.
 */
export class PaginatedOrders {
  @ApiProperty({
    description:
      'Total number of orders in the store, ignoring `limit`/`offset`. Use it ' +
      'to compute the page count.',
    example: 42,
    type: 'integer',
    minimum: 0,
  })
  total: number;

  @ApiProperty({
    description:
      'This page of orders, newest first. At most `limit` entries, and empty ' +
      'when `offset` is past the end (that is a `200`, not a `404`).',
    type: [Order],
  })
  items: Order[];
}
