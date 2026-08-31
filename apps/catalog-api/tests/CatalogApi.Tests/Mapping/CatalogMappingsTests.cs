using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using CatalogApi.Contracts;
using CatalogApi.Contracts.Mapping;
using CatalogApi.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace CatalogApi.Tests.Mapping;

public class CatalogMappingsTests
{
    private static readonly JsonSerializerOptions ApiJsonOptions = CreateApiJsonOptions();

    private static JsonSerializerOptions CreateApiJsonOptions()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));

        return options;
    }

    private static Product CreateProduct() => new()
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
    };

    [Fact]
    public void ProductToDto_CopiesEveryField()
    {
        Product product = CreateProduct();

        ProductDto dto = product.ToDto();

        dto.Id.Should().Be(101);
        dto.CategoryId.Should().Be(1);
        dto.Slug.Should().Be("milk-3");
        dto.NameEn.Should().Be("Milk 3%");
        dto.NameHe.Should().Be("חלב 3%");
        dto.Unit.Should().Be(ProductUnit.Carton);
        dto.PricePerUnit.Should().Be(6.90m);
        dto.Emoji.Should().Be("🥛");
        dto.IsActive.Should().BeTrue();
    }

    [Fact]
    public void ProductToDto_KeepsInactiveFlag()
    {
        Product product = CreateProduct();
        product.IsActive = false;

        product.ToDto().IsActive.Should().BeFalse();
    }

    [Fact]
    public void ProductToDto_NullProduct_Throws()
    {
        Product? product = null;

        Action act = () => _ = product!.ToDto();

        act.Should().Throw<ArgumentNullException>();
    }

    [Fact]
    public void CategoryToDto_UsesNavigationPropertyWhenNoProductsPassed()
    {
        var category = new Category
        {
            Id = 1,
            Slug = "dairy",
            NameEn = "Dairy",
            NameHe = "מוצרי חלב",
            SortOrder = 1,
            Products = new List<Product> { CreateProduct() }
        };

        CategoryDto dto = category.ToDto();

        dto.Id.Should().Be(1);
        dto.Slug.Should().Be("dairy");
        dto.NameEn.Should().Be("Dairy");
        dto.NameHe.Should().Be("מוצרי חלב");
        dto.SortOrder.Should().Be(1);
        dto.Products.Should().ContainSingle();
        dto.Products[0].Slug.Should().Be("milk-3");
    }

    [Fact]
    public void CategoryToDto_ExplicitProductsWin()
    {
        var category = new Category
        {
            Id = 1,
            Slug = "dairy",
            NameEn = "Dairy",
            NameHe = "מוצרי חלב",
            SortOrder = 1,
            Products = new List<Product> { CreateProduct() }
        };

        Product other = CreateProduct();
        other.Id = 999;
        other.Slug = "butter";

        CategoryDto dto = category.ToDto(new List<Product> { other });

        dto.Products.Should().ContainSingle();
        dto.Products[0].Id.Should().Be(999);
        dto.Products[0].Slug.Should().Be("butter");
    }

    [Fact]
    public void CategoryToDto_EmptyNavigation_ProducesEmptyList()
    {
        var category = new Category
        {
            Id = 5,
            Slug = "empty",
            NameEn = "Empty",
            NameHe = "ריק",
            SortOrder = 9
        };

        CategoryDto dto = category.ToDto();

        dto.Products.Should().NotBeNull();
        dto.Products.Should().BeEmpty();
    }

    [Fact]
    public void CategoryToDto_NullCategory_Throws()
    {
        Category? category = null;

        Action act = () => _ = category!.ToDto();

        act.Should().Throw<ArgumentNullException>();
    }

    [Fact]
    public void ToDtoList_PreservesOrder()
    {
        Product first = CreateProduct();
        Product second = CreateProduct();
        second.Id = 102;
        second.Slug = "cottage-cheese";

        IReadOnlyList<ProductDto> dtos = new List<Product> { second, first }.ToDtoList();

        dtos.Select(d => d.Id).Should().ContainInOrder(102, 101);
    }

    [Theory]
    [InlineData(ProductUnit.Unit, "unit")]
    [InlineData(ProductUnit.Kg, "kg")]
    [InlineData(ProductUnit.Pack, "pack")]
    [InlineData(ProductUnit.Bottle, "bottle")]
    [InlineData(ProductUnit.Carton, "carton")]
    public void ProductDto_SerialisesUnitAsLowercaseContractString(ProductUnit unit, string expected)
    {
        Product product = CreateProduct();
        product.Unit = unit;

        string json = JsonSerializer.Serialize(product.ToDto(), ApiJsonOptions);

        json.Should().Contain("\"unit\":\"" + expected + "\"");
    }

    [Fact]
    public void CategoryDto_SerialisesWithCamelCaseContractPropertyNames()
    {
        var category = new Category
        {
            Id = 1,
            Slug = "dairy",
            NameEn = "Dairy",
            NameHe = "מוצרי חלב",
            SortOrder = 1,
            Products = new List<Product> { CreateProduct() }
        };

        string json = JsonSerializer.Serialize(category.ToDto(), ApiJsonOptions);

        json.Should().Contain("\"id\":1");
        json.Should().Contain("\"slug\":\"dairy\"");
        json.Should().Contain("\"nameEn\":\"Dairy\"");
        json.Should().Contain("\"nameHe\":");
        json.Should().Contain("\"sortOrder\":1");
        json.Should().Contain("\"products\":");
        json.Should().Contain("\"categoryId\":1");
        json.Should().Contain("\"pricePerUnit\":6.9");
        json.Should().Contain("\"isActive\":true");
    }
}
