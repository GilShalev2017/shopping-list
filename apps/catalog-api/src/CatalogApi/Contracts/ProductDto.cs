using CatalogApi.Domain.Entities;

namespace CatalogApi.Contracts;

/// <summary>
/// Wire shape of a product, exactly as specified in docs/CONTRACT.md section 2.
/// Serialised camelCase; <see cref="Unit"/> is emitted as a lowercase string
/// ("unit" | "kg" | "pack" | "bottle" | "carton") by the globally registered
/// <c>JsonStringEnumConverter(JsonNamingPolicy.CamelCase)</c>.
/// </summary>
/// <param name="Id">Product id.</param>
/// <param name="CategoryId">Owning category id.</param>
/// <param name="Slug">Stable url-safe key.</param>
/// <param name="NameEn">English name.</param>
/// <param name="NameHe">Hebrew name.</param>
/// <param name="Unit">Selling unit.</param>
/// <param name="PricePerUnit">Price in ILS per unit.</param>
/// <param name="Emoji">Tile emoji.</param>
/// <param name="IsActive">Whether the product is sold.</param>
public sealed record ProductDto(
    int Id,
    int CategoryId,
    string Slug,
    string NameEn,
    string NameHe,
    ProductUnit Unit,
    decimal PricePerUnit,
    string Emoji,
    bool IsActive);
