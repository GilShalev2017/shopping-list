import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';

/** `STORE_HEALTH_INDICATOR` comes from the global `PersistenceModule`. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
