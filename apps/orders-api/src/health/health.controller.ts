import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  STORE_HEALTH_INDICATOR,
  StoreHealthIndicator,
} from '../persistence/order-repository.interface';
import { HealthResponse } from './dto/health.response';

/**
 * Deliberately *not* mounted under the `/api` prefix (see `app.setup.ts`) so
 * container orchestrators can probe a stable, version-independent path.
 *
 * Terminus is not used: the contract pins an exact, non-Terminus body shape,
 * and a single store probe does not justify the extra dependency.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(STORE_HEALTH_INDICATOR)
    private readonly indicator: StoreHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'checkHealth',
    summary: 'Liveness of the API and of the configured NoSQL store',
    description: [
      'Probes whichever store `NOSQL_DRIVER` selected and reports it back.',
      '',
      'This is the endpoint that makes the *pluggable store* claim checkable in',
      'one request: restart the service with `NOSQL_DRIVER=mongodb` and `driver`',
      'changes here while every `/api/orders` response stays byte-identical.',
      '',
      'It sits at the **root**, outside the `/api` prefix, so the Docker',
      'HEALTHCHECK and any orchestrator probe have a path that never moves.',
      'Failure detail (which can contain a connection string) is logged, never',
      'returned.',
    ].join('\n'),
  })
  @ApiOkResponse({
    description: 'The API is up and the store answered.',
    type: HealthResponse,
  })
  @ApiServiceUnavailableResponse({
    description:
      'The store did not answer. The body is the same shape with ' +
      '`status: "error"` and `store: "disconnected"`.',
    type: HealthResponse,
  })
  async check(): Promise<HealthResponse> {
    const result = await this.indicator.check();
    const body: HealthResponse = {
      status: result.status,
      driver: this.indicator.driver,
      store: result.store,
    };

    if (result.status !== 'ok') {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }
}
