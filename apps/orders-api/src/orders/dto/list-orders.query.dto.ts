import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;
export const DEFAULT_LIST_OFFSET = 0;

/** Query string of `GET /api/orders?limit=20&offset=0`. */
export class ListOrdersQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_LIST_LIMIT,
    default: DEFAULT_LIST_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit: number = DEFAULT_LIST_LIMIT;

  @ApiPropertyOptional({ minimum: 0, default: DEFAULT_LIST_OFFSET })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = DEFAULT_LIST_OFFSET;
}
