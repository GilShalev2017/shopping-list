import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { PACKAGE_INFO } from './common/package-info';
import { AppConfig } from './config/configuration';

export const GLOBAL_PREFIX = 'api';

/** Swagger UI path. Nest serves the raw document at `<path>-json` alongside it. */
export const SWAGGER_PATH = 'docs';

/** Where the machine-readable document lives — derived, never hard-coded. */
export const SWAGGER_JSON_PATH = `${SWAGGER_PATH}-json`;

/** Tag names, kept in one place so `@ApiTags(...)` and `addTag(...)` cannot drift. */
export const SWAGGER_TAGS = {
  orders: 'orders',
  health: 'health',
} as const;

/**
 * The long-form `info.description`, rendered as Markdown at the top of the
 * Swagger UI. It is the first thing a reader sees, so it answers the three
 * questions a reviewer actually has: what is this, what is unusual about it,
 * and how do I try it.
 */
const API_DESCRIPTION = [
  'Persists the **confirmed orders from screen 2** of the shopping-list assignment.',
  'The client sends the three delivery-form fields plus the cart it built on screen 1;',
  'this service validates them, computes every total itself, and writes one document',
  'per order.',
  '',
  '### Pluggable NoSQL store',
  '',
  'The store is chosen at boot by the `NOSQL_DRIVER` environment variable and nothing',
  'above the repository port knows which one is live:',
  '',
  '| `NOSQL_DRIVER` | Adapter | Notes |',
  '| --- | --- | --- |',
  '| `elasticsearch` *(default)* | `@elastic/elasticsearch` v8 | Index auto-created from `infra/elasticsearch/orders.mapping.json`; writes use `refresh: "wait_for"` so an order is readable immediately. |',
  '| `mongodb` | official `mongodb` driver v6 | Same document shape, indexes on `createdAt`, `id` (unique) and `reference`. |',
  '',
  'Switching is one environment variable and a restart — no code change, no rebuild,',
  'and every response below stays byte-identical. `GET /health` echoes back which',
  'driver is actually answering.',
  '',
  '### What the server owns',
  '',
  '`lineTotal`, `itemCount` and `totalAmount` are **never read from the request**.',
  'They are recomputed from `quantity` × `unitPrice` and rounded to agorot, alongside',
  'the generated `id` (ULID), `reference`, `status` and `createdAt`. A payload that',
  'carries any of them is rejected with `400`, so tampering fails loudly.',
  '',
  '### Validation',
  '',
  'A global `ValidationPipe` runs with `whitelist`, `forbidNonWhitelisted` and',
  '`transform` enabled. Errors come back as a `message` **array** with one entry per',
  'violated constraint — every violation at once, with nested paths such as',
  '`items.0.quantity`.',
  '',
  '### Conventions',
  '',
  '- Base path `/api`; `GET /health` deliberately sits at the root so orchestrator',
  '  probes have a path that never moves.',
  '- All bodies are `application/json`, camelCase, UTF-8. Hebrew is stored and',
  '  returned verbatim.',
  '- Money is ILS with at most 2 decimals.',
  '',
  `The machine-readable document is served at \`/${SWAGGER_JSON_PATH}\`.`,
  'Shapes here are the ones pinned by `docs/CONTRACT.md` §3 and are shared with the',
  'client and the catalog service.',
].join('\n');

/**
 * Builds the OpenAPI document for this application.
 *
 * Exported separately from {@link configureApp} so the document can be produced
 * and asserted on without standing up an HTTP listener.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Orders API')
    .setDescription(API_DESCRIPTION)
    // Straight from package.json, so a released image and the document it
    // serves can never disagree about the version.
    .setVersion(PACKAGE_INFO.version)
    .addServer(
      'http://localhost:3000',
      'Local development and Docker Compose (host port 3000)',
    )
    .addServer(
      'http://orders-api:3000',
      'Inside the Docker Compose network (service name)',
    )
    .addTag(
      SWAGGER_TAGS.orders,
      'Creating and reading the confirmed orders from screen 2. Totals, ids and ' +
        'timestamps are all server-generated.',
    )
    .addTag(
      SWAGGER_TAGS.health,
      'Liveness probe that also reports which NoSQL driver is currently wired in.',
    )
    .build();

  return SwaggerModule.createDocument(app, config);
}

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

  // Swagger UI at /docs, raw document at /docs-json (Nest derives the latter
  // from the former; SWAGGER_JSON_PATH keeps that fact in one named place).
  SwaggerModule.setup(SWAGGER_PATH, app, buildOpenApiDocument(app), {
    customSiteTitle: `Orders API — OpenAPI ${PACKAGE_INFO.version}`,
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    swaggerOptions: {
      // Survives a page reload, so a reader does not re-enter anything.
      persistAuthorization: true,
      // Shows how long each "Try it out" call took — handy when the point of
      // the service is that two different stores answer the same contract.
      displayRequestDuration: true,
      // Endpoints listed but collapsed: the whole surface fits on one screen.
      docExpansion: 'list',
      tryItOutEnabled: true,
      filter: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 3,
    },
  });

  return app;
}
