using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CatalogApi.Application.Exceptions;
using CatalogApi.Application.Services;
using CatalogApi.Contracts;
using CatalogApi.Domain.Entities;
using CatalogApi.Infrastructure.Persistence;
using FluentAssertions;
using Xunit;

namespace CatalogApi.Tests.Services;

public class CatalogServiceTests
{
    private static readonly string[] DairyProductSlugs = ["milk-3", "cottage-cheese"];

    private static readonly string[] ProductSlugs = ["milk-3", "cottage-cheese", "challah"];

    [Fact]
    public async Task GetCategoriesAsync_ReturnsCategoriesOrderedBySortOrder()
    {
        using CatalogDbContext context = TestContextFactory.CreateSeededContext();
        var service = new CatalogService(context);

        IReadOnlyList<CategoryDto> result = await service.GetCategoriesAsync(CancellationToken.None);

        result.Should().HaveCount(2);
        result.Select(c => c.Slug).Should().ContainInOrder("dairy", "bakery");
        result.Select(c => c.SortOrder).Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task GetCategoriesAsync_AttachesProductsToTheirOwnCategory()
    {
        using CatalogDbContext context = TestContextFactory.CreateSeededContext();
        var service = new CatalogService(context);

        IReadOnlyList<CategoryDto> result = await service.GetCategoriesAsync();

        CategoryDto dairy = result.Single(c => c.Slug == "dairy");
        CategoryDto bakery = result.Single(c => c.Slug == "bakery");

        dairy.Products.Select(p => p.Slug).Should().BeEquivalentTo(DairyProductSlugs);
        bakery.Products.Select(p => p.Slug).Should().BeEquivalentTo(["challah"]);
        dairy.Products.Should().OnlyContain(p => p.CategoryId == dairy.Id);
        bakery.Products.Should().OnlyContain(p => p.CategoryId == bakery.Id);
    }

    [Fact]
    public async Task GetCategoriesAsync_ExcludesInactiveProducts()
    {
        using CatalogDbContext context = TestContextFactory.CreateSeededContext();
        var service = new CatalogService(context);

        IReadOnlyList<CategoryDto> result = await service.GetCategoriesAsync();

        result.SelectMany(c => c.Products)
            .Should().NotContain(p => p.Slug == "discontinued-cream");
        result.SelectMany(c => c.Products)
            .Should().OnlyContain(p => p.IsActive);
    }

    [Fact]
    public async Task GetCategoriesAsync_MapsEveryFieldOfTheContract()
    {
        using CatalogDbContext context = TestContextFactory.CreateSeededContext();
        var service = new CatalogService(context);

        IReadOnlyList<CategoryDto> result = await service.GetCategoriesAsync();

        CategoryDto dairy = result.Single(c => c.Slug == "dairy");
        dairy.Id.Should().Be(1);
        dairy.NameEn.Should().Be("Dairy");
        dairy.NameHe.Should().Be("מוצרי חלב");
        dairy.SortOrder.Should().Be(1);

        ProductDto milk = dairy.Products.Single(p => p.Slug == "milk-3");
        milk.Id.Should().Be(101);
        milk.CategoryId.Should().Be(1);
        milk.NameEn.Should().Be("Milk 3%");
        milk.NameHe.Should().Be("חלב 3%");
        milk.Unit.Should().Be(ProductUnit.Carton);
        milk.PricePerUnit.Should().Be(6.90m);
        milk.Emoji.Should().Be("🥛");
        milk.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task GetCategoriesAsync_ReturnsEmptyProductListForCategoryWithoutProducts()
    {
        using CatalogDbContext context = TestContextFactory.CreateContext();
        context.Categories.Add(new Category
        {
            Id = 7,
            Slug = "empty",
            NameEn = "Empty",
            NameHe = "ריק",
            SortOrder = 1
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var service = new CatalogService(context);

        IReadOnlyList<CategoryDto> result = await service.GetCategoriesAsync();

        result.Should().ContainSingle();
        result[0].Products.Should().NotBeNull();
        result[0].Products.Should().BeEmpty();
    }

    [Fact]
    public async Task GetCategoriesAsync_OnEmptyDatabase_ReturnsEmptyList()
    {
        using CatalogDbContext context = TestContextFactory.CreateContext();
        var service = new CatalogService(context);

        IReadOnlyList<CategoryDto> result = await service.GetCategoriesAsync();

        result.Should().NotBeNull();
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetCategoryByIdAsync_ReturnsCategoryWithItsActiveProducts()
    {
        using CatalogDbContext context = TestContextFactory.CreateSeededContext();
        var service = new CatalogService(context);

        CategoryDto result = await service.GetCategoryByIdAsync(1, CancellationToken.None);

        result.Id.Should().Be(1);
        result.Slug.Should().Be("dairy");
        result.Products.Should().HaveCount(2);
        result.Products.Select(p => p.Id).Should().ContainInOrder(101, 102);
    }

    [Fact]
    public async Task GetCategoryByIdAsync_UnknownId_ThrowsNotFoundWithContractMessage()
    {
        using CatalogDbContext context = TestContextFactory.CreateSeededContext();
        var service = new CatalogService(context);

        Func<Task> act = async () => await service.GetCategoryByIdAsync(99);

        (await act.Should().ThrowAsync<NotFoundException>())
            .WithMessage("Category 99 was not found.");
    }

    [Fact]
    public async Task GetProductsAsync_WithoutFilter_ReturnsEveryActiveProduct()
    {
        using CatalogDbContext context = TestContextFactory.CreateSeededContext();
        var service = new CatalogService(context);

        IReadOnlyList<ProductDto> result = await service.GetProductsAsync(null, CancellationToken.None);

        result.Should().HaveCount(3);
        result.Select(p => p.Slug).Should().BeEquivalentTo(ProductSlugs);
        result.Should().OnlyContain(p => p.IsActive);
    }

    [Fact]
    public async Task GetProductsAsync_WithCategoryFilter_ReturnsOnlyThatCategory()
    {
        using CatalogDbContext context = TestContextFactory.CreateSeededContext();
        var service = new CatalogService(context);

        IReadOnlyList<ProductDto> result = await service.GetProductsAsync(2);

        result.Should().ContainSingle();
        result[0].Slug.Should().Be("challah");
        result[0].CategoryId.Should().Be(2);
    }

    [Fact]
    public async Task GetProductsAsync_UnknownCategory_ThrowsNotFound()
    {
        using CatalogDbContext context = TestContextFactory.CreateSeededContext();
        var service = new CatalogService(context);

        Func<Task> act = async () => await service.GetProductsAsync(4242);

        (await act.Should().ThrowAsync<NotFoundException>())
            .WithMessage("Category 4242 was not found.");
    }

    [Fact]
    public async Task GetProductsAsync_IsOrderedByCategoryThenId()
    {
        using CatalogDbContext context = TestContextFactory.CreateSeededContext();
        var service = new CatalogService(context);

        IReadOnlyList<ProductDto> result = await service.GetProductsAsync(null);

        result.Select(p => p.Id).Should().ContainInOrder(101, 102, 201);
    }

    [Fact]
    public void Constructor_NullContext_Throws()
    {
        Action act = () => _ = new CatalogService(null!);

        act.Should().Throw<ArgumentNullException>();
    }
}
