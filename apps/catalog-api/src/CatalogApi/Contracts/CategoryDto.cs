using System.Collections.Generic;

namespace CatalogApi.Contracts;

/// <summary>
/// One aisle of the catalog: a category together with its active products, exactly as
/// specified in docs/CONTRACT.md section 2. Products are nested rather than linked so
/// screen 1 can render from a single <c>GET /api/categories</c> on page load.
/// </summary>
/// <example>{"id":1,"slug":"dairy","nameEn":"Dairy","nameHe":"מוצרי חלב","sortOrder":1,"products":[{"id":101,"categoryId":1,"slug":"milk-3","nameEn":"Milk 3%","nameHe":"חלב 3%","unit":"carton","pricePerUnit":6.90,"emoji":"🥛","isActive":true}]}</example>
/// <param name="Id">Database identity of the category. Example: <c>1</c>.</param>
/// <param name="Slug">Stable url-safe key, unique across the catalog. Example: <c>dairy</c>.</param>
/// <param name="NameEn">English display name. Example: <c>Dairy</c>.</param>
/// <param name="NameHe">Hebrew display name, used when the client locale is <c>he</c>. Example: <c>מוצרי חלב</c>.</param>
/// <param name="SortOrder">
/// Ascending display order; the API sorts by this before returning, so the client should
/// render in the order it receives. Example: <c>1</c>.
/// </param>
/// <param name="Products">
/// The category's active products, ordered by id. Never <c>null</c> — a category with no
/// active products comes back with an empty array rather than being omitted.
/// </param>
public sealed record CategoryDto(
    int Id,
    string Slug,
    string NameEn,
    string NameHe,
    int SortOrder,
    IReadOnlyList<ProductDto> Products);
