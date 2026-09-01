import { ApiProperty } from '@nestjs/swagger';

import { NOSQL_DRIVERS, NosqlDriver } from '../../config/configuration';

/**
 * Body of `GET /health` — the exact shape pinned by `docs/CONTRACT.md` §3.
 *
 * The same object is returned with `200` when the store answers and carried as
 * the body of a `503 Service Unavailable` when it does not, so one class
 * documents both responses.
 */
export class HealthResponse {
  @ApiProperty({
    enum: ['ok', 'error'],
    example: 'ok',
    description:
      'Overall verdict. `error` is returned with HTTP 503 so an orchestrator ' +
      'can act on the status line alone.',
  })
  status: 'ok' | 'error';

  @ApiProperty({
    enum: NOSQL_DRIVERS as unknown as string[],
    example: 'elasticsearch',
    description:
      'Which NoSQL adapter is actually wired in, straight from `NOSQL_DRIVER`. ' +
      'This is the cheapest way to confirm that a driver swap took effect.',
  })
  driver: NosqlDriver;

  @ApiProperty({
    enum: ['connected', 'disconnected'],
    example: 'connected',
    description: 'Result of a live probe against that store (ping / cluster info).',
  })
  store: 'connected' | 'disconnected';
}
