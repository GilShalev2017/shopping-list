namespace CatalogApi.Domain.Entities;

/// <summary>
/// A single purchasable product inside a <see cref="Category"/>.
/// </summary>
public class Product
{
    /// <summary>Database identity.</summary>
    public int Id { get; set; }

    /// <summary>Foreign key to the owning category.</summary>
    public int CategoryId { get; set; }

    /// <summary>The owning category navigation property.</summary>
    public Category Category { get; set; } = null!;

    /// <summary>Stable, url-safe, unique key, e.g. "milk-3".</summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>English display name.</summary>
    public string NameEn { get; set; } = string.Empty;

    /// <summary>Hebrew display name.</summary>
    public string NameHe { get; set; } = string.Empty;

    /// <summary>The unit the product is priced by.</summary>
    public ProductUnit Unit { get; set; } = ProductUnit.Unit;

    /// <summary>Price in ILS for one <see cref="Unit"/>, decimal(10,2).</summary>
    public decimal PricePerUnit { get; set; }

    /// <summary>A single emoji used as the product tile icon.</summary>
    public string Emoji { get; set; } = string.Empty;

    /// <summary>Whether the product is currently sold. Inactive products are hidden from the API.</summary>
    public bool IsActive { get; set; } = true;
}
