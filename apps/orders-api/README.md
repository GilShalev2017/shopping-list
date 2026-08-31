# orders-api

NestJS 11 service that persists **confirmed shopping-list orders** to a NoSQL
store. It backs screen 2 of the assignment: the client posts the three customer
form fields plus the cart, this service validates them, computes the totals
itself, and writes one document per order.

The headline design decision is that the store is **pluggable at runtime**.
`NOSQL_DRIVER=elasticsearch` (the default, and the driver the assignment asks
for) and `NOSQL_DRIVER=mongodb` are both fully implemented, and neither the
controller nor the service knows which one is live.

Contract: [`docs/CONTRACT.md`](../../docs/CONTRACT.md) §3 (endpoints) and §4
(environment variables). Nothing in this service deviates from it.

---

## API

Base path `/api`, except `/health` which sits at the root so orchestrators get a
stable probe path.

| Method | Path                            | Description                                     |
| ------ | ------------------------------- | ----------------------------------------------- |
| `POST` | `/api/orders`                   | Confirm an order → `201` with the stored order  |
| `GET`  | `/api/orders/:id`               | Single order, or `404`                          |
| `GET`  | `/api/orders?limit=20&offset=0` | `{ total, items }`, newest first                |
| `GET`  | `/health`                       | `{ status, driver, store }`, `503` if store down |
| `GET`  | `/docs`                         | Swagger UI (`/docs-json` for the raw OpenAPI)   |

```bash
curl -s localhost:3000/api/orders -H 'content-type: application/json' -d '{
  "customer": {
    "fullName": "ישראל ישראלי",
    "address": "הרצל 10, תל אביב",
    "email": "israel@example.com"
  },
  "items": [
    { "productId": 101, "categoryId": 1, "nameEn": "Milk 3%", "nameHe": "חלב 3%",
      "unit": "carton", "quantity": 2, "unitPrice": 6.90 }
  ],
  "locale": "he"
}'
```

### Server-side totals

`lineTotal`, `itemCount` and `totalAmount` are **never read from the request**.
`OrdersService` recomputes them from `quantity` and `unitPrice`, rounding each
result to 2 decimals (agorot):

```
lineTotal   = round2(quantity * unitPrice)
itemCount   = Σ quantity
totalAmount = round2(Σ lineTotal)
```

`id` (a ULID) , `reference` (`ORD-` + 6 uppercase hex), `status: "confirmed"`,
`currency: "ILS"` and `createdAt` are all server-generated too. A payload that
carries a `lineTotal` or `totalAmount` is rejected with `400` by
`forbidNonWhitelisted`, so tampering is loud rather than silent.

### Validation

`class-validator` + `class-transformer`, wired through a global `ValidationPipe`
with `whitelist`, `forbidNonWhitelisted` and `transform` all on. Nested objects
and arrays use `@ValidateNested({ each: true })` + `@Type(() => …)`, so an
invalid cart line reports as `items.3.quantity` rather than as a vague
`items` error. `fullName` additionally goes through a custom, Unicode-aware
`@IsTwoWords()` validator (so `ישראל ישראלי` passes and `ישראל` does not).

---

## Architecture — ports and adapters

```
                       HTTP  (validated DTOs in, Order JSON out)
                          │
              ┌───────────▼────────────┐        ┌──────────────────┐
              │   OrdersController     │        │ HealthController │
              └───────────┬────────────┘        └────────┬─────────┘
                          │                              │
              ┌───────────▼────────────┐                 │
              │     OrdersService      │  totals, ULID,  │
              │  (no store knowledge)  │  reference      │
              └───────────┬────────────┘                 │
                          │                              │
   ═══════════════════════▼══════════════════════════════▼═══════════════  PORTS
        abstract class OrderRepository          abstract class StoreHealthIndicator
        token: ORDER_REPOSITORY                 token: STORE_HEALTH_INDICATOR
   ══════════════════════════════════════════════════════════════════════
                          ▲                              ▲
              ┌───────────┴──────────────────────────────┴────────────┐
              │       PersistenceModule.forRoot(config)               │
              │   reads NOSQL_DRIVER and binds EXACTLY ONE adapter    │
              └───────────┬──────────────────────────────┬────────────┘
                          │                              │
      ┌───────────────────▼──────────┐   ┌───────────────▼─────────────────┐
      │ ElasticsearchOrderRepository │   │     MongoOrderRepository        │
      │ ElasticsearchStoreHealth…    │   │     MongoStoreHealthIndicator   │
      │ ElasticsearchIndexBootstrap  │   │     MongoConnection (+indexes)  │
      │ @elastic/elasticsearch v8    │   │     mongodb driver v6           │
      └──────────────────────────────┘   └─────────────────────────────────┘
                (default)                            (drop-in)
```

Two things make this real rather than decorative:

- `orders/` contains **no import** from `persistence/elasticsearch/` or
  `persistence/mongodb/`. Only the port is imported. `orders.module.spec.ts`
  asserts that `OrdersModule` imports nothing at all.
- Both adapters are run against the **same shared contract test suite**
  (`src/persistence/__tests__/order-repository.contract.ts`), with an extra
  `cross-driver equivalence` test that runs the identical sequence of
  operations through both and asserts the two results are deep-equal. Swapping
  drivers is therefore proven — not merely claimed — to be behaviour-preserving.

### Switching drivers

One environment variable, no code change, no rebuild:

```bash
NOSQL_DRIVER=elasticsearch npm run start:dev   # default
NOSQL_DRIVER=mongodb       npm run start:dev
```

`PersistenceModule.forRoot()` reads the config at composition time and returns a
`DynamicModule` containing that driver's providers only — the other driver's
client is never constructed. `GET /health` echoes back which one is live.

Adding a third store (DynamoDB, Cosmos, …) means writing one adapter class plus
one `*DriverProviders()` function, and adding one `case`. Nothing else changes.

---

## Elasticsearch index bootstrap

On startup `ElasticsearchIndexBootstrap` (an `OnModuleInit`) calls
`indices.exists` and, only if the index is absent, creates it from
[`infra/elasticsearch/orders.mapping.json`](../../infra/elasticsearch/orders.mapping.json).

The mapping file is located by walking **up** the directory tree from the
compiled module looking for `infra/elasticsearch/orders.mapping.json`. That
works from `src/` under ts-jest, from `dist/` after `nest build`, and from
`/app/dist` in the container — without hard-coding a `../../../..` chain.
`ORDERS_MAPPING_PATH` overrides the search for unusual deployments.

If the file cannot be found or read, the service falls back to
`EMBEDDED_ORDERS_INDEX_DEFINITION`, a copy of the same JSON compiled into
`elasticsearch-index.bootstrap.ts`, so a container without `infra/` mounted still
gets a correct index. **The duplication is guarded by a test**:
`orders-mapping-sync.spec.ts` deep-equals the constant against the file and
fails the build if they drift.

Bootstrap failure is logged, not fatal — a cold Elasticsearch should not put the
API into a crash loop. `GET /health` reports `store: "disconnected"` instead.

Writes use `refresh: 'wait_for'`, so an order is visible to the very next
`GET /api/orders/:id` or list call. Without it the confirmation screen could
POST an order and immediately get an empty list back inside Elasticsearch's
default 1-second refresh interval.

### Why `items` is `nested`

If `items` were a plain `object`, Elasticsearch would flatten the array into
parallel lists of values — `items.nameEn: ["Milk 3%", "Bread"]` and
`items.quantity: [2, 10]` — losing which value belongs to which line. A query
for "orders containing *Milk* with quantity ≥ 10" would then match an order that
has 2 milks and 10 breads: a **false positive**.

`"type": "nested"` indexes each cart line as its own hidden Lucene document, so
a `nested` query keeps the per-line correlation and that false positive
disappears. The price is that each line is a separate document (indexing cost)
and that per-item queries must be wrapped in a `nested` clause. For an orders
index — where "which orders contain product X at quantity Y" is the obvious
analytics question — that trade is clearly worth making.

Other mapping choices, all in the JSON with a `_meta` block naming the app and
schema version:

| Field                | Type                          | Why                                                              |
| -------------------- | ----------------------------- | ---------------------------------------------------------------- |
| `id`, `reference`    | `keyword`                     | Exact lookup only; never analysed.                               |
| `customer.fullName`  | `text` + `.keyword`           | Full-text search *and* exact match / aggregation on one field.   |
| `customer.email`     | `keyword` + normalizer        | `lowercase_normalizer` so `A@X.com` and `a@x.com` are one term.  |
| `customer.address`   | `text`                        | Free-text search; no need to aggregate on a street address.      |
| `items`              | `nested`                      | See above.                                                        |
| money fields         | `scaled_float(100)`           | Exact agorot arithmetic; no binary-float surprises in sums.      |
| counts / ids         | `integer`                     | Compact and range-queryable.                                     |
| `dynamic`            | `"strict"`                    | An unexpected field is *rejected*, not silently mapped.          |
| shards / replicas    | `1` / `0`                     | Single-node local cluster: a replica would leave it yellow.      |

`dynamic: "strict"` is what makes `OrderMapper.toPersistence()` load-bearing:
it emits exactly the ten mapped top-level fields and nothing else.

## MongoDB driver

Uses the **official `mongodb` driver, not Mongoose**. The document shape is
already defined once by `OrderMapper` (and mirrored by the Elasticsearch
mapping); a Mongoose schema would be a third place for it to drift, and it would
break the symmetry with the ES client. The adapter is ~50 lines as a result.

`MongoConnection` creates the single pooled client (`maxPoolSize` from config),
connects on `onModuleInit`, creates the indexes matching the access patterns —
`createdAt` descending for the newest-first listing, **unique** on `id`, and one
on `reference` — and closes the client on `onApplicationShutdown`. Mongo's own
`_id` is never written by the adapter and is projected away on read, so the
documents in Mongo and in Elasticsearch are byte-identical.

---

## Running it

```bash
npm install
cp .env.example .env          # every value in it is already the default
npm run start:dev             # http://localhost:3000, Swagger at /docs
```

Backing stores for local development:

```bash
docker run -d -p 9200:9200 -e discovery.type=single-node \
  -e xpack.security.enabled=false docker.elastic.co/elasticsearch/elasticsearch:8.15.0
docker run -d -p 27017:27017 mongo:7
```

### Environment variables

All of these are `docs/CONTRACT.md` §4, plus two additions marked below.

| Var                      | Default                     | Notes                             |
| ------------------------ | --------------------------- | --------------------------------- |
| `PORT`                   | `3000`                      |                                   |
| `NOSQL_DRIVER`           | `elasticsearch`             | `elasticsearch` \| `mongodb`      |
| `ELASTICSEARCH_NODE`     | `http://localhost:9200`     |                                   |
| `ELASTICSEARCH_INDEX`    | `orders`                    |                                   |
| `ELASTICSEARCH_USERNAME` | _(empty)_                   | optional basic auth               |
| `ELASTICSEARCH_PASSWORD` | _(empty)_                   |                                   |
| `MONGODB_URI`            | `mongodb://localhost:27017` |                                   |
| `MONGODB_DATABASE`       | `orders`                    |                                   |
| `MONGODB_COLLECTION`     | `orders`                    |                                   |
| `CORS_ORIGINS`           | `http://localhost:5173`     | comma separated                   |
| `MONGODB_MAX_POOL_SIZE`  | `10`                        | *addition* — connection pool size |
| `ORDERS_MAPPING_PATH`    | _(auto-discovered)_         | *addition* — mapping file override |

The environment is validated by a Joi schema at boot, so `NOSQL_DRIVER=elastic`
fails immediately with a readable message instead of half-starting.

### Docker

The build context is the **repository root**, so the mapping file can be copied
in:

```bash
docker build -f apps/orders-api/Dockerfile -t orders-api .
docker run -p 3000:3000 -e NOSQL_DRIVER=elasticsearch \
  -e ELASTICSEARCH_NODE=http://host.docker.internal:9200 orders-api
```

Three stages on `node:22-alpine`: compile with dev dependencies, install
production dependencies separately, then a runtime image that copies only
`dist/`, `node_modules/` and the mapping file. Runs as the non-root `node` user
under `dumb-init` so `SIGTERM` reaches Nest's shutdown hooks and the store
connections close cleanly.

---

## Tests

```bash
npm test          # unit + integration, with coverage thresholds enforced
npm run test:cov  # same, explicit
npm run test:watch
npm run test:e2e  # supertest against a real Nest app
npm run lint
npm run build
```

`npm test` collects coverage by default and fails below **90 % statements /
lines / functions and 85 % branches**, so a green run is also a coverage proof.
Current: **100 % statements, 100 % lines, 100 % functions, 99.15 % branches**
across 300 tests.

What is covered, and why each part earns its place:

| Suite                                | What it pins down                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `money.util.spec`                    | Rounding at the float boundaries (`1.005`, `3 × 19.9`, `7 × 4.15`) and drift over 100 lines. |
| `id.util.spec`                       | ULID shape, sortability, no ambiguous letters, collision-free over 5 000 draws.        |
| `is-two-words.validator.spec`        | Hebrew / Arabic / accented / hyphenated names; punctuation is not a word.              |
| `configuration.spec`                 | Every documented default, every override, and rejection of an unknown `NOSQL_DRIVER`.  |
| `create-order.dto.spec`              | ~35 table-driven invalid payloads, each asserting the *exact* failing constraint key.  |
| `order.mapper.spec`                  | Round trip, JSON hop, defensive coercion of untyped store output.                      |
| `orders.service.spec`                | Totals maths, generated fields, delegation, not-found, pagination pass-through.        |
| `orders.controller.spec`             | Each route's wiring and 404 propagation.                                               |
| **`order-repository.contract.spec`** | **The same suite against both adapters, plus a cross-driver equivalence assertion.**   |
| `elasticsearch-index.bootstrap.spec` | Both create-if-absent branches, path resolution, embedded fallback, non-fatal failure. |
| `orders-mapping-sync.spec`           | The JSON deliverable and the embedded constant cannot drift.                           |
| `persistence.module.spec`            | Exactly one adapter is bound per token, for each driver.                               |
| `app.module.spec`                    | The whole graph compiles under both drivers.                                           |
| `orders.e2e-spec`                    | Real HTTP: 201 happy path, 400 message arrays, 404, list, `/health`, prefix rules.     |

The e2e suite boots the real `AppModule` — real config, real global prefix, real
validation pipe, real Swagger — and overrides only `ORDER_REPOSITORY` with an
in-memory fake. That fake is a *third* implementation of the same port, and the
fact that every HTTP assertion holds against it is one more piece of evidence
that the boundary is real.

`main.ts` is the only file excluded from coverage: it is a `NestFactory.create`
wrapper with no logic of its own. Everything it configures lives in
`app.setup.ts`, which is covered at 100 %.

---

## Layout

```
apps/orders-api/
├── src/
│   ├── main.ts                     bootstrap
│   ├── app.setup.ts                pipes, prefix, CORS, Swagger (shared with e2e)
│   ├── app.module.ts               composition root
│   ├── common/                     ulid + reference, money rounding, IsTwoWords
│   ├── config/configuration.ts     typed config factory + Joi env validation
│   ├── health/                     GET /health
│   ├── orders/                     controller, service, DTOs, entity, mapper
│   └── persistence/
│       ├── order-repository.interface.ts    ← the ports
│       ├── persistence.module.ts            ← the adapter selector
│       ├── elasticsearch/                   ← adapter 1 (default)
│       └── mongodb/                         ← adapter 2
└── test/                           e2e spec + in-memory repository
```

## Notes and deliberate choices

- **`@nestjs/terminus` is not used.** `docs/CONTRACT.md` pins an exact
  `{ status, driver, store }` health body, which is not Terminus's shape, and a
  single store probe does not justify the dependency. `StoreHealthIndicator` is
  a two-method port with one implementation per driver.
- **`unit` is validated as a bounded string, not an enum.** The contract lists
  the catalog's units (`unit | kg | pack | bottle | carton`) but specifies only
  "required" for the orders payload. Hard-coding the enum here would mean
  redeploying this service every time the catalog adds a unit.
- **The entity classes double as the OpenAPI schema.** One definition, decorated
  with `@ApiProperty`, rather than a parallel set of response DTOs that can drift.
- **`ELASTICSEARCH_INDEX` and the mapping are decoupled.** The bootstrap creates
  whatever index name is configured using the same mapping, so `orders-v2` for a
  re-index is just an env change.
