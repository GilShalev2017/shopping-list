import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';

import { OrderLocale } from '../entities/order.entity';
import { OrderCustomerDto } from './order-customer.dto';
import { OrderItemDto } from './order-item.dto';

export const ORDER_LOCALES: readonly OrderLocale[] = ['he', 'en'];
export const DEFAULT_ORDER_LOCALE: OrderLocale = 'he';

/** A cart may hold at most this many distinct lines. */
export const MAX_ORDER_ITEMS = 100;

/**
 * Body of `POST /api/orders` — `docs/CONTRACT.md` §3.
 *
 * Exactly the three customer form fields from screen 2 plus the cart carried
 * over from screen 1. Nothing else is accepted: the global `ValidationPipe`
 * runs with `whitelist` **and** `forbidNonWhitelisted`, so an extra property
 * such as `totalAmount` is a `400`, not a silently dropped field.
 */
export class CreateOrderDto {
  @ApiProperty({
    description:
      'The three required delivery-form fields from screen 2. Validated as a ' +
      'nested object, so failures are reported as `customer.email …` rather ' +
      'than as one opaque `customer` error.',
    type: OrderCustomerDto,
  })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => OrderCustomerDto)
  customer: OrderCustomerDto;

  @ApiProperty({
    description:
      'The cart, one entry per product. Must contain between 1 and ' +
      `${MAX_ORDER_ITEMS} lines — an empty cart is a \`400\`, not an empty ` +
      'order. Each line is validated individually and reported by index ' +
      '(`items.0.quantity must not be less than 1`).',
    type: [OrderItemDto],
    minItems: 1,
    maxItems: MAX_ORDER_ITEMS,
  })
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ORDER_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({
    description:
      'Language the order was placed in. Stored on the order and echoed back so ' +
      'the confirmation screen and any later notification can be rendered in ' +
      'the same language the shopper used. Defaults to Hebrew, which is the ' +
      "client's default locale.",
    enum: ORDER_LOCALES as OrderLocale[],
    enumName: 'OrderLocale',
    default: DEFAULT_ORDER_LOCALE,
    example: 'he',
  })
  @IsOptional()
  @IsIn(ORDER_LOCALES)
  locale?: OrderLocale;
}
