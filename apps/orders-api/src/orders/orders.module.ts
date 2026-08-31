import { Module } from '@nestjs/common';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

/**
 * Note there is no persistence import here: `ORDER_REPOSITORY` is supplied by
 * the global `PersistenceModule.forRoot()` in `AppModule`.
 */
@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
