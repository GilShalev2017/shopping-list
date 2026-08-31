using CatalogApi.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CatalogApi.Infrastructure.Persistence;

/// <summary>
/// Entity Framework Core context for the catalog database (SQL Server in production,
/// the in-memory provider in tests).
/// </summary>
public class CatalogDbContext : DbContext
{
    /// <summary>Creates the context.</summary>
    /// <param name="options">Provider options supplied by DI.</param>
    public CatalogDbContext(DbContextOptions<CatalogDbContext> options)
        : base(options)
    {
    }

    /// <summary>Shopping categories.</summary>
    public DbSet<Category> Categories => Set<Category>();

    /// <summary>Products belonging to categories.</summary>
    public DbSet<Product> Products => Set<Product>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Picks up CategoryConfiguration and ProductConfiguration.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CatalogDbContext).Assembly);
    }
}
