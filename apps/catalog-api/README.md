# catalog-api

ASP.NET Core **.NET 10** Web API serving the shopping categories and products for
screen 1, backed by **SQL Server** through **Entity Framework Core 10**.

Implements section 2 of [`docs/CONTRACT.md`](../../docs/CONTRACT.md).

---

## Endpoints

| Method | Path                              | Returns                                                     |
| ------ | --------------------------------- | ----------------------------------------------------------- |
| `GET`  | `/api/categories`                 | Every category ordered by `sortOrder`, each with its active products |
| `GET`  | `/api/categories/{id}`            | One category with its active products, `404` if unknown      |
| `GET`  | `/api/products`                   | Every active product, flat                                   |
| `GET`  | `/api/products?categoryId={id}`   | Active products in one category, `404` if the category is unknown |
| `GET`  | `/health`                         | `{ "status": "healthy", "database": "connected" }`           |
| `GET`  | `/swagger`                        | Swagger UI (enabled in every environment)                    |
| `GET`  | `/swagger/v1/swagger.json`        | The raw OpenAPI 3 document                                   |

All responses are `application/json` in camelCase. `unit` is serialised as one of
`unit`, `kg`, `pack`, `bottle`, `carton`.

Errors are RFC 7807 `application/problem+json`:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Not Found",
  "status": 404,
  "detail": "Category 99 was not found.",
  "instance": "/api/categories/99",
  "traceId": "0HN7..."
}
```

---

## OpenAPI

The generated document is treated as part of the deliverable, not as a by-product.
Swagger UI is on in **every** environment (including the container) because the point of
this service is to be read and driven by someone else.

| What | Where |
| ---- | ----- |
| Swagger UI | <http://localhost:5080/swagger> |
| Raw OpenAPI 3 document | <http://localhost:5080/swagger/v1/swagger.json> |

```bash
curl -s http://localhost:5080/swagger/v1/swagger.json | jq '.info.title, (.paths | keys)'
```

That path is the Swashbuckle default and is deliberately left alone, so it stays stable
for client generators:

```bash
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:5080/swagger/v1/swagger.json -g typescript-fetch -o ./generated
```

### What is in the document

- **Document metadata** — title `Catalog API`, version `v1`, and a description that says
  what the service is for: screen 1's categories and products, read from SQL Server
  through EF Core, shaped by section 2 of the contract.
- **XML documentation comments.** `CatalogApi.csproj` sets
  `GenerateDocumentationFile=true`, and `Program.cs` feeds the resulting `CatalogApi.xml`
  to SwaggerGen. Every endpoint's summary, remarks, parameter text and per-status-code
  description in the UI is written in the source next to the code it describes, so the two
  cannot drift apart. `NoWarn` includes `1591`, so undocumented internals do not generate
  build noise.
- **Operation grouping.** Actions are grouped by controller — **Categories**, **Products**,
  **Health** — and each group's blurb is that controller's `<summary>`.
- **Declared responses.** Every action declares its success type plus its failure types via
  `[ProducesResponseType]`: `404` and `500` are documented as RFC 7807 `ProblemDetails`, so
  a consumer can see the error shape without triggering an error.
- **Schema examples.** `CategoryDto`, `ProductDto` and the health payload carry an
  `<example>` in their XML comments holding a real contract-shaped JSON object — Hebrew,
  emoji, `unit` as a string and all. No extra filter types and no attributes on the DTOs.
- **UI touches.** The page is titled *Catalog API*, the document dropdown reads
  *Catalog API v1*, and request durations are shown after each **Try it out**.

If `CatalogApi.xml` is ever missing from the publish output, the `IncludeXmlComments` call
is skipped (it is guarded by `File.Exists`) and the app starts normally with a thinner
document — a missing doc file can never take the service down.

---

## Environment variables

| Var                            | Default                                                          | Meaning |
| ------------------------------ | ---------------------------------------------------------------- | ------- |
| `ConnectionStrings__CatalogDb` | `Server=localhost,1433;Database=CatalogDb;User Id=sa;Password=Your_strong_Passw0rd;TrustServerCertificate=True;` | SQL Server connection |
| `Catalog__AutoMigrate`         | `true`                                                           | Create the schema on start-up |
| `Catalog__SeedData`            | `true`                                                           | Insert the catalog if the DB is empty |
| `Cors__AllowedOrigins__0`      | `http://localhost:5173`                                          | Allowed browser origin (repeat with `__1`, `__2`, …). Empty ⇒ any origin |
| `ASPNETCORE_URLS`              | `http://+:8080` in the container                                 | Listen address |

`Catalog__AutoMigrate=true` makes the app create **and** seed the database on start-up,
retrying the SQL Server connection up to **10 times** with a linear back-off (2s, 4s, 6s …
capped at 15s), because the SQL Server container needs a while before it accepts logins.
If it still cannot connect the API starts anyway and `/health` reports `503` with
`"database": "disconnected"` rather than crash-looping.

---

## Running from an IDE (Rider / Visual Studio / `dotnet run`)

You need a SQL Server on `localhost:1433`. The quickest one:

```bash
docker run -d --name catalog-sql -p 1433:1433 \
  -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=Your_strong_Passw0rd \
  mcr.microsoft.com/mssql/server:2022-latest
```

Then:

```bash
cd apps/catalog-api
dotnet restore
dotnet run --project src/CatalogApi
```

The `CatalogApi` launch profile listens on **http://localhost:5080** and opens
`http://localhost:5080/swagger`. A second profile, `CatalogApi (no seed)`, runs with
`Catalog__AutoMigrate=false` / `Catalog__SeedData=false` if you want to point it at a
database you manage yourself.

Smoke test:

```bash
curl http://localhost:5080/health
curl http://localhost:5080/api/categories | head -c 400
curl "http://localhost:5080/api/products?categoryId=1"
```

---

## Running via Docker

The build context is this folder:

```bash
docker build -t catalog-api ./apps/catalog-api

docker run --rm -p 5080:8080 \
  -e ConnectionStrings__CatalogDb="Server=host.docker.internal,1433;Database=CatalogDb;User Id=sa;Password=Your_strong_Passw0rd;TrustServerCertificate=True;" \
  catalog-api
```

The image is a two-stage build (`sdk:10.0` → `aspnet:10.0`), publishes Release, runs as
the non-root `$APP_UID` user baked into the official runtime image, and exposes **8080**
(mapped to the contract's host port **5080**).

---

## Tests

```bash
cd apps/catalog-api
dotnet test
```

xUnit + FluentAssertions + Moq, with `Microsoft.EntityFrameworkCore.InMemory` for the
data-layer tests and `Microsoft.AspNetCore.Mvc.Testing` for the end-to-end ones. **No
SQL Server is needed** — the integration fixture swaps the `DbContext` registration for
the in-memory provider and seeds itself.

Coverage (via `coverlet.collector`):

```bash
dotnet test --collect:"XPlat Code Coverage"
```

| Suite                              | Covers |
| ---------------------------------- | ------ |
| `Services/CatalogServiceTests`     | Ordering, active-only filtering, per-category grouping, 404 paths |
| `Mapping/CatalogMappingsTests`     | Every DTO field, both `Category.ToDto` overloads, enum + camelCase JSON |
| `Persistence/CatalogSeederTests`   | Idempotency, ≥6 categories / ≥30 products, Hebrew + English + emoji + price on every row, unique slugs, mockup items |
| `Controllers/*ControllerTests`     | 200 payloads, filter forwarding, cancellation token, `NotFoundException` propagation |
| `Integration/CatalogEndpointsTests`| Real pipeline: all five endpoints, RFC 7807 404 body, CORS header, enum wire format |

---

## Layout

```
apps/catalog-api/
├── CatalogApi.sln
├── Directory.Build.props          net10.0, nullable, implicit usings
├── Dockerfile / .dockerignore
├── MIGRATIONS.md                  why EnsureCreated, and how to switch to migrations
├── src/CatalogApi/
│   ├── Domain/Entities            Category, Product, ProductUnit
│   ├── Contracts                  CategoryDto, ProductDto, Mapping/CatalogMappings
│   ├── Application                ICatalogService, CatalogService, NotFoundException
│   ├── Infrastructure/Persistence CatalogDbContext, Configurations/, CatalogSeeder, DatabaseInitializer
│   └── Api                        Controllers/, Middleware/ExceptionHandlingMiddleware
└── tests/CatalogApi.Tests/
```

Dependencies point inwards: `Api` → `Application` → `Domain`, with `Infrastructure`
implementing persistence and `Contracts` holding the wire shapes. No AutoMapper — the
entity→DTO projection is plain extension methods, so it is compile-time checked.

**Schema creation uses `EnsureCreatedAsync()`, not migrations.** The reasoning and the
exact command to generate real migrations are in [`MIGRATIONS.md`](./MIGRATIONS.md).
