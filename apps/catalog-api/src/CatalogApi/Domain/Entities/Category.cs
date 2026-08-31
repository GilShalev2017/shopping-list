using System.Collections.Generic;

namespace CatalogApi.Domain.Entities;

/// <summary>
/// A shopping category (aisle) of the supermarket, e.g. "Dairy" / "מוצרי חלב".
/// </summary>
public class Category
{
    /// <summary>Database identity.</summary>
    public int Id { get; set; }

    /// <summary>Stable, url-safe, unique key, e.g. "dairy".</summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>English display name.</summary>
    public string NameEn { get; set; } = string.Empty;

    /// <summary>Hebrew display name.</summary>
    public string NameHe { get; set; } = string.Empty;

    /// <summary>Ascending display order on screen 1.</summary>
    public int SortOrder { get; set; }

    /// <summary>Products that belong to this category.</summary>
    public ICollection<Product> Products { get; set; } = new List<Product>();
}
