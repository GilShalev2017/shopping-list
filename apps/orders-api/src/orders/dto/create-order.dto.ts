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

/** Body of `POST /api/orders` — `docs/CONTRACT.md` §3. */
export class CreateOrderDto {
  @ApiProperty({ type: OrderCustomerDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => OrderCustomerDto)
  customer: OrderCustomerDto;

  @ApiProperty({ type: [OrderItemDto], minItems: 1, maxItems: 100 })
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({
    enum: ORDER_LOCALES as OrderLocale[],
    default: DEFAULT_ORDER_LOCALE,
  })
  @IsOptional()
  @IsIn(ORDER_LOCALES)
  locale?: OrderLocale;
}
