using System;
using CatalogApi.Domain.Entities;
using CatalogApi.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CatalogApi.Tests;

/// <summary>
/// Builds isolated in-memory <see cref="CatalogDbContext"/> instances for the unit tests.
/// Every context gets a unique database name so tests never bleed into each other.
/// </summary>
internal static class TestContextFactory
{
    public static CatalogDbContext CreateContext(string? databaseName = null)
    {
        DbContextOptions<CatalogDbContext> options = new DbContextOptionsBuilder<CatalogDbContext>()
            .UseInMemoryDatabase(databaseName ?? "catalog-tests-" + Guid.NewGuid().ToString("N"))
            .EnableSensitiveDataLogging()
            .Options;

        return new CatalogDbContext(options);
    }

    /// <summary>
    /// A tiny, fully deterministic catalog: two categories, one of which owns an
    /// inactive product so the "active only" filtering is observable.
    /// </summary>
    public static CatalogDbContext CreateSeededContext(string? databaseName = null)
    {
        CatalogDbContext context = CreateContext(databaseName);

        var dairy = new Category
        {
            Id = 1,
            Slug = "dairy",
            NameEn = "Dairy",
            NameHe = "מוצרי חלב",
            SortOrder = 1
        };

        var bakery = new Category
        {
            Id = 2,
            Slug = "bakery",
            NameEn = "Bakery",
            NameHe = "מאפים",
            SortOrder = 2
        };

        // Deliberately added out of sortOrder order to prove the service sorts.
        context.Categories.Add(bakery);
        context.Categories.Add(dairy);

        context.Products.AddRange(
            new Product
            {
                Id = 101,
                CategoryId = 1,
                Slug = "milk-3",
                NameEn = "Milk 3%",
                NameHe = "חלב 3%",
                Unit = ProductUnit.Carton,
                PricePerUnit = 6.90m,
                Emoji = "🥛",
                IsActive = true
            },
            new Product
            {
                Id = 102,
                CategoryId = 1,
                Slug = "cottage-cheese",
                NameEn = "Cottage Cheese 5%",
                NameHe = "קוטג' 5%",
                Unit = ProductUnit.Unit,
                PricePerUnit = 7.50m,
                Emoji = "🧀",
                IsActive = true
            },
            new Product
            {
                Id = 103,
                CategoryId = 1,
                Slug = "discontinued-cream",
                NameEn = "Discontinued Cream",
                NameHe = "שמנת שירדה מהמדף",
                Unit = ProductUnit.Unit,
                PricePerUnit = 5.00m,
                Emoji = "🥛",
                IsActive = false
            },
            new Product
            {
                Id = 201,
                CategoryId = 2,
                Slug = "challah",
                NameEn = "Challah",
                NameHe = "חלה",
                Unit = ProductUnit.Unit,
                PricePerUnit = 13.90m,
                Emoji = "🥖",
                IsActive = true
            });

        context.SaveChanges();
        context.ChangeTracker.Clear();

        return context;
    }
}
