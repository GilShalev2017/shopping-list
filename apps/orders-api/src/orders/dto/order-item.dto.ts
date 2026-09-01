import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Documented ceiling for `unitPrice`; a supermarket line is never near it. */
export const MAX_UNIT_PRICE = 1_000_000;

/** Documented ceiling for `quantity` (per line, not per order). */
export const MAX_ITEM_QUANTITY = 999;

/**
 * One cart line posted from screen 1.
 *
 * The product fields (`nameEn`, `nameHe`, `unit`, `unitPrice`) are **copied**
 * from the catalog rather than re-fetched: an order is a historical record, so
 * it has to keep the name and price as they were at checkout even after the
 * catalog changes them. That is why this service does not call the catalog API.
 *
 * `unitPrice` is accepted but never trusted for the totals — `OrdersService`
 * recomputes `lineTotal`, `itemCount` and `totalAmount` server-side.
 */
export class OrderItemDto {
  @ApiProperty({
    description:
      'Catalog product id, as returned by `GET /api/products` on the catalog ' +
      'API. Stored as-is; this service does not verify it exists, because an ' +
      'order must survive the product being delisted.',
    example: 101,
    type: 'integer',
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  productId: number;

  @ApiProperty({
    description:
      'Catalog category id the product belonged to at checkout time. Kept on ' +
      'the line so "what did we sell in Dairy last month" is answerable from ' +
      'the orders index alone, without joining back to the catalog.',
    example: 1,
    type: 'integer',
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  categoryId: number;

  @ApiProperty({
    description:
      'English product name, snapshotted from the catalog. Both names are ' +
      'always stored so the confirmation e-mail and any back-office screen can ' +
      'be rendered in either language without a second lookup.',
    example: 'Milk 3%',
    minLength: 1,
    maxLength: 200,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameEn: string;

  @ApiProperty({
    description: 'Hebrew product name, snapshotted from the catalog.',
    example: 'חלב 3%',
    minLength: 1,
    maxLength: 200,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameHe: string;

  @ApiProperty({
    description:
      'Catalog unit of measure. The catalog currently emits `unit`, `kg`, ' +
      '`pack`, `bottle` and `carton`, but this field is validated as a bounded ' +
      '**string rather than an enum** on purpose: the contract only requires it ' +
      'to be present, and hard-coding the list here would mean redeploying the ' +
      'orders service every time the catalog adds a unit.',
    example: 'carton',
    minLength: 1,
    maxLength: 32,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  unit: string;

  @ApiProperty({
    description:
      'How many of this product were ordered. Integer — fractional amounts of ' +
      'a `kg` product are not supported by screen 1.',
    example: 2,
    type: 'integer',
    minimum: 1,
    maximum: MAX_ITEM_QUANTITY,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_ITEM_QUANTITY)
  quantity: number;

  @ApiProperty({
    description:
      'Price per unit in ILS at checkout time, at most 2 decimals (agorot). ' +
      'Sent by the client for the historical record only — it is re-rounded and ' +
      'multiplied server-side, and any `lineTotal` the client tries to send is ' +
      'rejected outright by `forbidNonWhitelisted`.',
    example: 6.9,
    type: 'number',
    format: 'double',
    minimum: 0,
    maximum: MAX_UNIT_PRICE,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_UNIT_PRICE)
  unitPrice: number;
}
