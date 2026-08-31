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

/**
 * One cart line posted from screen 1.
 *
 * `unitPrice` is accepted but never trusted — `OrdersService` recomputes
 * `lineTotal`, `itemCount` and `totalAmount` from these numbers server-side.
 */
export class OrderItemDto {
  @ApiProperty({ example: 101 })
  @IsInt()
  @IsPositive()
  productId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  categoryId: number;

  @ApiProperty({ example: 'Milk 3%', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameEn: string;

  @ApiProperty({ example: 'חלב 3%', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameHe: string;

  @ApiProperty({
    example: 'carton',
    maxLength: 32,
    description:
      'Catalog unit of measure (unit | kg | pack | bottle | carton). Kept as a ' +
      'free string so the orders service does not have to be redeployed when the ' +
      'catalog adds a new unit.',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  unit: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 999 })
  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;

  @ApiProperty({ example: 6.9, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  unitPrice: number;
}
