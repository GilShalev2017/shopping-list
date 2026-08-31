using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CatalogApi.Infrastructure.Persistence;

/// <summary>
/// Creates and seeds the catalog database on start-up.
/// </summary>
/// <remarks>
/// <para>
/// Schema creation uses <c>Database.EnsureCreatedAsync()</c> rather than
/// <c>Database.MigrateAsync()</c>.
/// See MIGRATIONS.md in the app folder for the reasoning and for the exact command that
/// regenerates real EF Core migrations if you would rather have them.
/// </para>
/// <para>
/// In Docker Compose the API container is usually up before SQL Server is accepting
/// logins, so every attempt is retried with a linear back-off.
/// </para>
/// </remarks>
public sealed class DatabaseInitializer
{
    /// <summary>Number of connection attempts before giving up.</summary>
    public const int MaxAttempts = 10;

    private readonly CatalogDbContext _dbContext;
    private readonly ILogger<DatabaseInitializer> _logger;
    private readonly bool _autoMigrate;
    private readonly bool _seedData;

    /// <summary>Creates the initializer.</summary>
    /// <param name="dbContext">The catalog context.</param>
    /// <param name="configuration">Application configuration (reads <c>Catalog:*</c>).</param>
    /// <param name="logger">Logger.</param>
    public DatabaseInitializer(
        CatalogDbContext dbContext,
        IConfiguration configuration,
        ILogger<DatabaseInitializer> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _logger = logger;

        // Catalog__AutoMigrate / Catalog__SeedData in the environment.
        _autoMigrate = configuration.GetValue<bool>("Catalog:AutoMigrate", true);
        _seedData = configuration.GetValue<bool>("Catalog:SeedData", true);
    }

    /// <summary>
    /// Ensures the schema exists and, when enabled, seeds it. Never throws: a catalog API
    /// that cannot reach SQL Server should still start and report itself unhealthy on
    /// <c>GET /health</c> rather than crash-loop the container.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        if (!_autoMigrate && !_seedData)
        {
            _logger.LogInformation(
                "Database initialisation skipped (Catalog:AutoMigrate and Catalog:SeedData are both false).");
            return;
        }

        for (int attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            try
            {
                if (_autoMigrate)
                {
                    bool created = await _dbContext.Database
                        .EnsureCreatedAsync(cancellationToken)
                        .ConfigureAwait(false);

                    _logger.LogInformation(
                        created
                            ? "Catalog schema created (attempt {Attempt})."
                            : "Catalog schema already present (attempt {Attempt}).",
                        attempt);
                }

                if (_seedData)
                {
                    bool seeded = await CatalogSeeder
                        .SeedAsync(_dbContext, cancellationToken)
                        .ConfigureAwait(false);

                    _logger.LogInformation(
                        seeded
                            ? "Catalog seed data inserted."
                            : "Catalog seed data skipped, categories already exist.");
                }

                return;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                if (attempt >= MaxAttempts)
                {
                    _logger.LogError(
                        ex,
                        "Database initialisation failed after {Attempts} attempts. The API will start anyway; /health will report the database as disconnected.",
                        MaxAttempts);
                    return;
                }

                TimeSpan delay = TimeSpan.FromSeconds(Math.Min(15, attempt * 2));

                _logger.LogWarning(
                    ex,
                    "Database not ready (attempt {Attempt}/{Attempts}). Retrying in {Delay}s.",
                    attempt,
                    MaxAttempts,
                    delay.TotalSeconds);

                await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
            }
        }
    }
}
