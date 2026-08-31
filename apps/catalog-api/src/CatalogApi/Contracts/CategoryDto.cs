using System.Collections.Generic;

namespace CatalogApi.Contracts;

/// <summary>
/// Wire shape of a category with its products, exactly as specified in
/// docs/CONTRACT.md section 2. Screen 1 renders from a single GET /api/categories.
/// </summary>
/// <param name="Id">Category id.</param>
/// <param name="Slug">Stable url-safe key.</param>
/// <param name="NameEn">English name.</param>
/// <param name="NameHe">Hebrew name.</param>
/// <param name="SortOrder">Ascending display order.</param>
/// <param name="Products">Active products in this category.</param>
public sealed record CategoryDto(
    int Id,
    string Slug,
    string NameEn,
    string NameHe,
    int SortOrder,
    IReadOnlyList<ProductDto> Products);
