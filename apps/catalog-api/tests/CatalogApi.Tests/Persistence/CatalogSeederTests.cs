using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CatalogApi.Domain.Entities;
using CatalogApi.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CatalogApi.Tests.Persistence;

public class CatalogSeederTests
{
    private static bool ContainsHebrew(string value) =>
        value.Any(c => c >= '\u0590' && c <= '\u05FF');

    [Fact]
    public async Task SeedAsync_OnEmptyDatabase_InsertsTheCatalog()
    {
        using CatalogDbContext context = TestContextFactory.CreateContext();

        bool seeded = await CatalogSeeder.SeedAsync(context);

        seeded.Should().BeTrue();
        (await context.Categories.CountAsync()).Should().BeGreaterThanOrEqualTo(6);
        (await context.Products.CountAsync()).Should().BeGreaterThanOrEqualTo(30);
    }

    [Fact]
    public async Task SeedAsync_IsIdempotent()
    {
        string databaseName = "seeder-idempotent-" + Guid.NewGuid().ToString("N");

        using (CatalogDbContext first = TestContextFactory.CreateContext(databaseName))
        {
            (await CatalogSeeder.SeedAsync(first)).Should().BeTrue();
        }

        int categories;
        int products;

        using (CatalogDbContext second = TestContextFactory.CreateContext(databaseName))
        {
            categories = await second.Categories.CountAsync();
            products = await second.Products.CountAsync();

            (await CatalogSeeder.SeedAsync(second)).Should().BeFalse();
        }

        using CatalogDbContext third = TestContextFactory.CreateContext(databaseName);

        (await third.Categories.CountAsync()).Should().Be(categories);
        (await third.Products.CountAsync()).Should().Be(products);
    }

    [Fact]
    public async Task SeedAsync_NullContext_Throws()
    {
        Func<Task> act = async () => await CatalogSeeder.SeedAsync(null!);

        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public void BuildCatalog_HasTheSixExpectedIsraeliSupermarketCategories()
    {
        IReadOnlyList<Category> catalog = CatalogSeeder.BuildCatalog();

        catalog.Select(c => c.Slug).Should().Contain(new[]
        {
            "dairy", "fruits-vegetables", "meat-fish", "bakery", "beverages", "snacks-sweets"
        });

        catalog.Select(c => c.SortOrder).Should().OnlyHaveUniqueItems();
        catalog.Select(c => c.SortOrder).Should().BeInAscendingOrder();
    }

    [Fact]
    public void BuildCatalog_EveryCategoryHasBothLanguagesAndProducts()
    {
        IReadOnlyList<Category> catalog = CatalogSeeder.BuildCatalog();

        catalog.Should().NotBeEmpty();

        foreach (Category category in catalog)
        {
            category.Slug.Should().NotBeNullOrWhiteSpace();
            category.NameEn.Should().NotBeNullOrWhiteSpace();
            category.NameHe.Should().NotBeNullOrWhiteSpace();
            ContainsHebrew(category.NameHe).Should().BeTrue(
                "category '{0}' must have a real Hebrew name", category.Slug);
            ContainsHebrew(category.NameEn).Should().BeFalse(
                "category '{0}' must have a real English name", category.Slug);
            category.Products.Should().NotBeEmpty();
        }
    }

    [Fact]
    public void BuildCatalog_EveryProductIsFullyPopulated()
    {
        IReadOnlyList<Product> products = CatalogSeeder.BuildCatalog()
            .SelectMany(c => c.Products)
            .ToList();

        products.Count.Should().BeGreaterThanOrEqualTo(30);

        foreach (Product product in products)
        {
            product.Slug.Should().NotBeNullOrWhiteSpace();
            product.NameEn.Should().NotBeNullOrWhiteSpace();
            product.NameHe.Should().NotBeNullOrWhiteSpace();
            ContainsHebrew(product.NameHe).Should().BeTrue(
                "product '{0}' must have a real Hebrew name", product.Slug);
            product.Emoji.Should().NotBeNullOrWhiteSpace();
            product.Emoji.Length.Should().BeLessThanOrEqualTo(16);
            product.PricePerUnit.Should().BeGreaterThan(0m);
            product.PricePerUnit.Should().BeLessThan(1000m);
            product.IsActive.Should().BeTrue();
            Enum.IsDefined(typeof(ProductUnit), product.Unit).Should().BeTrue();
        }
    }

    [Fact]
    public void BuildCatalog_SlugsAreUniqueAcrossTheWholeCatalog()
    {
        IReadOnlyList<Category> catalog = CatalogSeeder.BuildCatalog();

        catalog.Select(c => c.Slug).Should().OnlyHaveUniqueItems();
        catalog.SelectMany(c => c.Products).Select(p => p.Slug).Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public void BuildCatalog_ContainsTheProductsFromTheAssignmentMockup()
    {
        IReadOnlyList<string> hebrewNames = CatalogSeeder.BuildCatalog()
            .SelectMany(c => c.Products)
            .Select(p => p.NameHe)
            .ToList();

        foreach (string expected in new[] { "חלב 3%", "קוטג' 5%", "שמנת חמוצה 15%" })
        {
            hebrewNames.Should().Contain(expected);
        }

        hebrewNames.Should().Contain(n => n.Contains("בשר", StringComparison.Ordinal));
        hebrewNames.Should().Contain(n => n.Contains("בננות", StringComparison.Ordinal));
        hebrewNames.Should().Contain(n => n.Contains("שוקולד", StringComparison.Ordinal));
        hebrewNames.Should().Contain(n => n.Contains("סלמון", StringComparison.Ordinal));
    }

    [Fact]
    public void BuildCatalog_ReturnsAFreshGraphEachCall()
    {
        IReadOnlyList<Category> first = CatalogSeeder.BuildCatalog();
        IReadOnlyList<Category> second = CatalogSeeder.BuildCatalog();

        first.Should().NotBeSameAs(second);
        first[0].Should().NotBeSameAs(second[0]);
        first[0].Slug.Should().Be(second[0].Slug);
    }

    [Fact]
    public async Task SeedAsync_PersistsUnitsAndPricesRoundTrip()
    {
        using CatalogDbContext context = TestContextFactory.CreateContext();

        await CatalogSeeder.SeedAsync(context);
        context.ChangeTracker.Clear();

        Product milk = await context.Products.SingleAsync(p => p.Slug == "milk-3");

        milk.NameHe.Should().Be("חלב 3%");
        milk.Unit.Should().Be(ProductUnit.Carton);
        milk.PricePerUnit.Should().Be(6.90m);
        milk.CategoryId.Should().BeGreaterThan(0);

        Category dairy = await context.Categories.SingleAsync(c => c.Slug == "dairy");
        milk.CategoryId.Should().Be(dairy.Id);
    }
}
