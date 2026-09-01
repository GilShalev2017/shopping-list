using CatalogApi.Domain.Entities;

namespace CatalogApi.Contracts;

/// <summary>
/// A single product tile on screen 1 — exactly the shape specified in
/// docs/CONTRACT.md section 2, and the shape screen 2 echoes back inside an order.
/// Serialised camelCase; <see cref="Unit"/> is emitted as a lowercase string
/// ("unit" | "kg" | "pack" | "bottle" | "carton") by the globally registered
/// <c>JsonStringEnumConverter(JsonNamingPolicy.CamelCase)</c>.
/// Every product carries both languages so the client switches locale without a refetch.
/// </summary>
/// <example>{"id":101,"categoryId":1,"slug":"milk-3","nameEn":"Milk 3%","nameHe":"חלב 3%","unit":"carton","pricePerUnit":6.90,"emoji":"🥛","isActive":true}</example>
/// <param name="Id">Database identity of the product, and the key the client's cart is keyed by. Example: <c>101</c>.</param>
/// <param name="CategoryId">Id of the owning category. Example: <c>1</c>.</param>
/// <param name="Slug">Stable url-safe key, unique across the catalog. Example: <c>milk-3</c>.</param>
/// <param name="NameEn">English display name. Example: <c>Milk 3%</c>.</param>
/// <param name="NameHe">Hebrew display name, used when the client locale is <c>he</c>. Example: <c>חלב 3%</c>.</param>
/// <param name="Unit">
/// The unit this product is priced and sold in: <c>unit</c>, <c>kg</c>, <c>pack</c>,
/// <c>bottle</c> or <c>carton</c>. Example: <c>carton</c>.
/// </param>
/// <param name="PricePerUnit">
/// Price of one <see cref="Unit"/> in ILS, stored as SQL <c>decimal(10,2)</c> so money is
/// never rounded through a binary float. Example: <c>6.90</c>.
/// </param>
/// <param name="Emoji">Single emoji used as the product's artwork on the tile. Example: <c>🥛</c>.</param>
/// <param name="IsActive">
/// Whether the product is currently sold. The read endpoints only ever return
/// <c>true</c>; the flag is on the wire so a client can cache a payload and still tell.
/// </param>
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
