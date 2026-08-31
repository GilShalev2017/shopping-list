import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

import { NosqlDriver } from '../config/configuration';
import {
  STORE_HEALTH_INDICATOR,
  StoreHealthIndicator,
} from '../persistence/order-repository.interface';

/** `GET /health` response — `docs/CONTRACT.md` §3. */
export class HealthResponse {
  status: 'ok' | 'error';
  driver: NosqlDriver;
  store: 'connected' | 'disconnected';
}

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
  @ApiOperation({ summary: 'Liveness of the API and the configured NoSQL store' })
  @ApiOkResponse({ type: HealthResponse })
  @ApiServiceUnavailableResponse({ description: 'The store is unreachable.' })
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
