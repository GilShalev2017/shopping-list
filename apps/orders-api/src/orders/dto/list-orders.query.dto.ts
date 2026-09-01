import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;
export const DEFAULT_LIST_OFFSET = 0;

/**
 * Query string of `GET /api/orders?limit=20&offset=0`.
 *
 * Offset paging rather than a cursor: the contract asks for a `total`, the
 * back-office use case is "page through recent orders", and both adapters can
 * serve it natively (`from`/`size` in Elasticsearch, `skip`/`limit` in Mongo).
 * `limit` is capped so a single request cannot ask a cluster for everything.
 */
export class ListOrdersQueryDto {
  @ApiPropertyOptional({
    description:
      `Page size. Defaults to ${DEFAULT_LIST_LIMIT} and is capped at ` +
      `${MAX_LIST_LIMIT}; asking for more is a \`400\` rather than a silent ` +
      'clamp, so a client never believes it received a full page when it did not.',
    type: 'integer',
    minimum: 1,
    maximum: MAX_LIST_LIMIT,
    default: DEFAULT_LIST_LIMIT,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit: number = DEFAULT_LIST_LIMIT;

  @ApiPropertyOptional({
    description:
      'How many orders to skip, counting from the newest. `offset=20` with the ' +
      'default limit gives the second page.',
    type: 'integer',
    minimum: 0,
    default: DEFAULT_LIST_OFFSET,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = DEFAULT_LIST_OFFSET;
}
