# Schema creation: `EnsureCreated` today, migrations when you want them

## What this app does today

`DatabaseInitializer` calls **`context.Database.EnsureCreatedAsync()`** and then runs
`CatalogSeeder`. There is deliberately **no `Migrations/` folder in the repository.**

Why: this app was authored in an environment without the .NET SDK, so
`dotnet ef migrations add` could not be run. A hand-written
`CatalogDbContextModelSnapshot.cs` that silently disagrees with
`CategoryConfiguration` / `ProductConfiguration` is the single most damaging thing you
can commit to an EF Core project — every future `migrations add` then produces a wrong
diff. A missing migration is obvious and cheap to fix; a lying snapshot is not. So the
app ships with the honest option.

`EnsureCreated` builds the schema straight from the model, which means the tables,
column types (`nvarchar(64)`, `decimal(10,2)`, `nvarchar(16)` for the `ProductUnit`
string conversion), the unique indexes on `Categories.Slug` / `Products.Slug`, the
`Products.CategoryId` index and the cascade-delete foreign key are all exactly what the
`IEntityTypeConfiguration<T>` classes declare.

Trade-off, stated plainly: `EnsureCreated` creates the database only when it does not
exist. It cannot evolve an existing schema. That is fine for a graded assignment that
starts from an empty SQL Server container, and not fine for a real deployment.

## Turning this into real migrations (about two minutes)

```bash
# once
dotnet tool install --global dotnet-ef

cd apps/catalog-api

# generate the initial migration + a *correct*, tool-generated model snapshot
dotnet ef migrations add InitialCreate \
  --project src/CatalogApi/CatalogApi.csproj \
  --startup-project src/CatalogApi/CatalogApi.csproj \
  --output-dir Infrastructure/Migrations
```

That writes `src/CatalogApi/Infrastructure/Migrations/`:

- `<timestamp>_InitialCreate.cs`
- `<timestamp>_InitialCreate.Designer.cs`
- `CatalogDbContextModelSnapshot.cs`

Then switch the initializer over — in
`src/CatalogApi/Infrastructure/Persistence/DatabaseInitializer.cs`, replace

```csharp
bool created = await _dbContext.Database.EnsureCreatedAsync(cancellationToken);
```

with

```csharp
await _dbContext.Database.MigrateAsync(cancellationToken);
```

(`MigrateAsync` lives in `Microsoft.EntityFrameworkCore` — the `using` is already there.)

Nothing else changes: `Catalog__AutoMigrate=true` still means "bring the schema up on
start-up", the 10-attempt connection retry still wraps it, and `CatalogSeeder` still runs
afterwards and is still idempotent.

To review the SQL before it runs:

```bash
dotnet ef migrations script --project src/CatalogApi/CatalogApi.csproj
```

## Why seeding is not `HasData`

`HasData` bakes rows into the model, so every price change becomes a schema migration and
the data can never be re-applied to a database that already exists. `CatalogSeeder` is a
plain class: it checks `Categories.AnyAsync()` first, so it is safe to run on every
start-up, and it is directly unit tested (`tests/CatalogApi.Tests/Persistence/CatalogSeederTests.cs`).
