using System;
using System.Collections.Generic;
using System.Linq;
using CatalogApi.Domain.Entities;

namespace CatalogApi.Contracts.Mapping;

/// <summary>
/// Entity -&gt; DTO projection. Plain extension methods on purpose: no AutoMapper,
/// so the mapping is compile-time checked, trivially unit testable and allocation-cheap.
/// </summary>
public static class CatalogMappings
{
    /// <summary>Projects a <see cref="Product"/> onto its wire shape.</summary>
    public static ProductDto ToDto(this Product product)
    {
        ArgumentNullException.ThrowIfNull(product);

        return new ProductDto(
            product.Id,
            product.CategoryId,
            product.Slug,
            product.NameEn,
            product.NameHe,
            product.Unit,
            product.PricePerUnit,
            product.Emoji,
            product.IsActive);
    }

    /// <summary>Projects a sequence of products, preserving the incoming order.</summary>
    public static IReadOnlyList<ProductDto> ToDtoList(this IEnumerable<Product> products)
    {
        ArgumentNullException.ThrowIfNull(products);

        return products.Select(p => p.ToDto()).ToList();
    }

    /// <summary>
    /// Projects a <see cref="Category"/> using the products already loaded on its
    /// navigation property.
    /// </summary>
    public static CategoryDto ToDto(this Category category)
    {
        ArgumentNullException.ThrowIfNull(category);

        return category.ToDto(category.Products);
    }

    /// <summary>
    /// Projects a <see cref="Category"/> using an explicit product list. The service
    /// layer loads categories and products with two flat queries and stitches them here,
    /// which keeps both queries trivially translatable by any EF Core provider.
    /// </summary>
    /// <param name="category">The category to project.</param>
    /// <param name="products">
    /// Products to attach; when <c>null</c> the category's own navigation property is used.
    /// </param>
    public static CategoryDto ToDto(this Category category, IEnumerable<Product>? products)
    {
        ArgumentNullException.ThrowIfNull(category);

        IEnumerable<Product> source = products ?? category.Products;

        return new CategoryDto(
            category.Id,
            category.Slug,
            category.NameEn,
            category.NameHe,
            category.SortOrder,
            source.Select(p => p.ToDto()).ToList());
    }

    /// <summary>Projects a sequence of categories, preserving the incoming order.</summary>
    public static IReadOnlyList<CategoryDto> ToDtoList(this IEnumerable<Category> categories)
    {
        ArgumentNullException.ThrowIfNull(categories);

        return categories.Select(c => c.ToDto()).ToList();
    }
}
