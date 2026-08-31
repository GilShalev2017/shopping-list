import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppConfig } from './config/configuration';

export const GLOBAL_PREFIX = 'api';
export const SWAGGER_PATH = 'docs';

/**
 * Everything that turns a bare Nest application into *this* API.
 *
 * Extracted out of `main.ts` so the e2e suite boots a byte-identical app: if
 * the validation pipe or the prefix rules ever change, the e2e tests change
 * with them instead of silently testing a different application.
 */
export function configureApp(app: INestApplication, config: AppConfig): INestApplication {
  // `/health` stays at the root so orchestrators get a stable probe path,
  // everything else lives under /api per docs/CONTRACT.md §3.
  app.setGlobalPrefix(GLOBAL_PREFIX, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    maxAge: 600,
  });

  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Orders API')
      .setDescription(
        'Persists confirmed shopping-list orders to a pluggable NoSQL store ' +
          '(Elasticsearch by default, MongoDB via NOSQL_DRIVER).',
      )
      .setVersion('1.0')
      .addTag('orders')
      .addTag('health')
      .build(),
  );
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  return app;
}
