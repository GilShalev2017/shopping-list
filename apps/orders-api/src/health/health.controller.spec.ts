import { Global, Module, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { NosqlDriver } from '../config/configuration';
import {
  STORE_HEALTH_INDICATOR,
  StoreHealth,
  StoreHealthIndicator,
} from '../persistence/order-repository.interface';
import { HealthController } from './health.controller';
import { HealthModule } from './health.module';

/**
 * Stands in for `PersistenceModule.forRoot()`, which is what supplies
 * `STORE_HEALTH_INDICATOR` globally in the real application.
 */
function fakePersistenceModule(indicator: StoreHealthIndicator): unknown {
  @Global()
  @Module({
    providers: [{ provide: STORE_HEALTH_INDICATOR, useValue: indicator }],
    exports: [STORE_HEALTH_INDICATOR],
  })
  class FakePersistenceModule {}
  return FakePersistenceModule;
}

async function createController(
  driver: NosqlDriver,
  result: StoreHealth,
): Promise<HealthController> {
  const indicator: StoreHealthIndicator = {
    driver,
    check: jest.fn().mockResolvedValue(result),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [fakePersistenceModule(indicator) as never, HealthModule],
  }).compile();

  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  it('returns the exact shape from docs/CONTRACT.md §3 for elasticsearch', async () => {
    const controller = await createController('elasticsearch', {
      status: 'ok',
      store: 'connected',
    });

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      driver: 'elasticsearch',
      store: 'connected',
    });
  });

  it('reports whichever driver is actually wired in', async () => {
    const controller = await createController('mongodb', {
      status: 'ok',
      store: 'connected',
    });

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      driver: 'mongodb',
      store: 'connected',
    });
  });

  it('throws a 503 carrying the same body when the store is down', async () => {
    const controller = await createController('elasticsearch', {
      status: 'error',
      store: 'disconnected',
      detail: 'ECONNREFUSED',
    });

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(controller.check()).rejects.toMatchObject({
      status: 503,
      response: { status: 'error', driver: 'elasticsearch', store: 'disconnected' },
    });
  });

  it('does not leak the failure detail to the client', async () => {
    const controller = await createController('mongodb', {
      status: 'error',
      store: 'disconnected',
      detail: 'mongodb://user:password@host',
    });

    await expect(controller.check()).rejects.toMatchObject({
      response: expect.not.objectContaining({ detail: expect.anything() }),
    });
  });

  it('is the controller registered by HealthModule', async () => {
    const controller = await createController('elasticsearch', {
      status: 'ok',
      store: 'connected',
    });
    expect(controller).toBeInstanceOf(HealthController);
    expect(
      (Reflect.getMetadata('controllers', HealthModule) as unknown[]) ?? [],
    ).toContain(HealthController);
  });
});
