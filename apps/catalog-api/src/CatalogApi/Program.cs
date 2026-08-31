using System;
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

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

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

app.UseSwagger();
app.UseSwaggerUI();

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
