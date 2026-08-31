import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { ORDER_REPOSITORY } from '../persistence/order-repository.interface';
import { OrdersController } from './orders.controller';
import { OrdersModule } from './orders.module';
import { OrdersService } from './orders.service';

@Global()
@Module({
  providers: [
    {
      provide: ORDER_REPOSITORY,
      useValue: { save: jest.fn(), findById: jest.fn(), list: jest.fn() },
    },
  ],
  exports: [ORDER_REPOSITORY],
})
class FakePersistenceModule {}

describe('OrdersModule', () => {
  it('registers the controller and service, taking ORDER_REPOSITORY from outside', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakePersistenceModule, OrdersModule],
    }).compile();

    expect(moduleRef.get(OrdersController)).toBeInstanceOf(OrdersController);
    expect(moduleRef.get(OrdersService)).toBeInstanceOf(OrdersService);
    await moduleRef.close();
  });

  it('exports OrdersService for other feature modules', () => {
    expect((Reflect.getMetadata('exports', OrdersModule) as unknown[]) ?? []).toContain(
      OrdersService,
    );
  });

  it('imports nothing from the persistence layer — the port is injected globally', () => {
    expect((Reflect.getMetadata('imports', OrdersModule) as unknown[]) ?? []).toEqual([]);
  });
});
