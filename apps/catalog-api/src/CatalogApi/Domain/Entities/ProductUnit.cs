namespace CatalogApi.Domain.Entities;

/// <summary>
/// The unit a product is sold in.
/// Persisted to SQL Server as its string name (see <c>ProductConfiguration</c>) and
/// serialised to JSON in camelCase ("unit", "kg", "pack", "bottle", "carton").
/// </summary>
public enum ProductUnit
{
    /// <summary>A single item.</summary>
    Unit = 0,

    /// <summary>Sold by weight, price is per kilogram.</summary>
    Kg = 1,

    /// <summary>A multi-item pack.</summary>
    Pack = 2,

    /// <summary>A bottle.</summary>
    Bottle = 3,

    /// <summary>A carton (milk, juice, eggs).</summary>
    Carton = 4
}
