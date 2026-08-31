import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration, { validationSchema } from './config/configuration';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import { PersistenceModule } from './persistence/persistence.module';

/**
 * Composition root.
 *
 * `ConfigModule.forRoot()` is listed first on purpose: it loads `.env` and
 * merges it into `process.env` synchronously, so the `PersistenceModule.forRoot()`
 * expression evaluated immediately after it already sees the final environment.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    PersistenceModule.forRoot(),
    OrdersModule,
    HealthModule,
  ],
})
export class AppModule {}
