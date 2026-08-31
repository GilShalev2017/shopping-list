import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp, GLOBAL_PREFIX, SWAGGER_PATH } from './app.setup';
import { buildConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const config = buildConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  configureApp(app, config);

  await app.listen(config.port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`Orders API listening on port ${config.port}`);
  logger.log(`REST base path  : /${GLOBAL_PREFIX}`);
  logger.log(`Swagger UI      : /${SWAGGER_PATH}`);
  logger.log(`NoSQL driver    : ${config.nosqlDriver}`);
  logger.log(`CORS origins    : ${config.corsOrigins.join(', ') || '(none)'}`);
}

void bootstrap();
