using System;
using System.IO;
using System.Reflection;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using CatalogApi.Api.Middleware;
using CatalogApi.Application.Abstractions;
using CatalogApi.Application.Services;
using CatalogApi.Infrastructure.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Swashbuckle.AspNetCore.SwaggerUI;

const string CorsPolicyName = "catalog-cors";

const string DefaultConnectionString =
    "Server=localhost,1433;Database=CatalogDb;User Id=sa;Password=Your_strong_Passw0rd;TrustServerCertificate=True;";

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;

        // Emit Hebrew as real characters instead of \uXXXX escapes.
        options.JsonSerializerOptions.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping;

        // ProductUnit -> "unit" | "kg" | "pack" | "bottle" | "carton"
        options.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
    });

// ---------------------------------------------------------------------------
// OpenAPI / Swagger
//
// The generated document is part of the deliverable, not an afterthought: it is
// what a consumer of this service reads before writing a single line of client
// code. Everything below is the long-stable Swashbuckle configuration surface.
// ---------------------------------------------------------------------------

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    // Target-typed `new()` on purpose. The OpenApiInfo type has moved namespace
    // between Microsoft.OpenApi majors (Microsoft.OpenApi.Models -> Microsoft.OpenApi),
    // and this form never has to name it, so the Swashbuckle version stays free to move.
    options.SwaggerDoc("v1", new()
    {
        Title = "Catalog API",
        Version = "v1",
        Description =
            "Read-only catalog behind **screen 1** of the shopping-list assignment. " +
            "Categories and products are stored in **SQL Server** and read through " +
            "**EF Core 10**; the wire shapes are fixed by section 2 of `docs/CONTRACT.md`.\n\n" +
            "- `GET /api/categories` embeds each category's products, so the entire " +
            "screen renders from **one request on page load** (assignment requirement 1).\n" +
            "- `GET /api/products` is the same data flat, optionally filtered by category, " +
            "for callers that do not want the nested shape.\n" +
            "- Responses are JSON in camelCase. `unit` is a string: " +
            "`unit` | `kg` | `pack` | `bottle` | `carton`. Prices are decimal ILS per unit.\n" +
            "- Only active products are ever returned.\n" +
            "- Errors are RFC 7807 `application/problem+json`, produced centrally by " +
            "`ExceptionHandlingMiddleware`, with a `traceId` extension for correlation.\n\n" +
            "The raw document is served at `/swagger/v1/swagger.json`."
    });

    // XML doc comments are the source of every summary, parameter description,
    // response text and example in this document; see GenerateDocumentationFile
    // in CatalogApi.csproj. Guarded by File.Exists so a publish that somehow did
    // not carry the .xml file degrades to a thinner document instead of throwing
    // on start-up.
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);

    if (File.Exists(xmlPath))
    {
        // The second argument also lifts each controller's <summary> onto the tag
        // its actions are grouped under in the UI.
        options.IncludeXmlComments(xmlPath, true);
    }
});

string connectionString =
    builder.Configuration.GetConnectionString("CatalogDb") ?? DefaultConnectionString;

builder.Services.AddDbContext<CatalogDbContext>(options =>
{
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        // SQL Server in Compose drops connections while it warms up.
        sqlOptions.EnableRetryOnFailure();
        sqlOptions.CommandTimeout(60);
    });
});

builder.Services.AddScoped<ICatalogService, CatalogService>();
builder.Services.AddScoped<DatabaseInitializer>();

string[] allowedOrigins =
    builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicyName, policy =>
    {
        if (allowedOrigins.Length == 0)
        {
            policy.AllowAnyOrigin();
        }
        else
        {
            policy.WithOrigins(allowedOrigins);
        }

        policy.AllowAnyHeader();
        policy.AllowAnyMethod();
    });
});

WebApplication app = builder.Build();

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

// First in the pipeline so it traps everything downstream.
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Raw document: /swagger/v1/swagger.json (the Swashbuckle default route, kept as-is
// so the path stays stable for codegen tools). UI: /swagger.
app.UseSwagger();

app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Catalog API v1");
    options.RoutePrefix = "swagger";
    options.DocumentTitle = "Catalog API";
    options.DisplayRequestDuration();
});

app.UseRouting();
app.UseCors(CorsPolicyName);

app.MapControllers();

// ---------------------------------------------------------------------------
// Start-up: create + seed the database (Catalog__AutoMigrate / Catalog__SeedData)
// ---------------------------------------------------------------------------

using (IServiceScope scope = app.Services.CreateScope())
{
    DatabaseInitializer initializer =
        scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();

    await initializer.InitializeAsync(CancellationToken.None).ConfigureAwait(false);
}

app.Run();

/// <summary>
/// Exposed so the integration tests can drive the real pipeline through
/// <c>WebApplicationFactory&lt;Program&gt;</c>.
/// </summary>
public partial class Program
{
}
