using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CatalogApi.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CatalogApi.Infrastructure.Persistence;

/// <summary>
/// Idempotent seed data for the catalog: a believable small Israeli supermarket.
/// </summary>
/// <remarks>
/// Seeding lives here rather than in <c>HasData</c> on purpose. <c>HasData</c> bakes rows
/// into the model, which means every price tweak becomes a schema migration and the data
/// can never be re-applied to an already-created database. A plain seeder can be re-run
/// safely on every start-up and is directly unit testable.
/// </remarks>
public static class CatalogSeeder
{
    /// <summary>
    /// Inserts the catalog if, and only if, the database has no categories yet.
    /// </summary>
    /// <param name="dbContext">Target context.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns><c>true</c> when rows were written, <c>false</c> when seeding was skipped.</returns>
    public static async Task<bool> SeedAsync(CatalogDbContext dbContext, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(dbContext);

        bool alreadySeeded = await dbContext.Categories
            .AnyAsync(cancellationToken)
            .ConfigureAwait(false);

        if (alreadySeeded)
        {
            return false;
        }

        IReadOnlyList<Category> catalog = BuildCatalog();

        await dbContext.Categories
            .AddRangeAsync(catalog, cancellationToken)
            .ConfigureAwait(false);

        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        return true;
    }

    /// <summary>
    /// Builds the in-memory object graph that gets inserted. Ids are left at 0 so the
    /// database assigns identity values and the products cascade-insert with their parent.
    /// </summary>
    public static IReadOnlyList<Category> BuildCatalog()
    {
        return new List<Category>
        {
            new Category
            {
                Slug = "dairy",
                NameEn = "Dairy",
                NameHe = "מוצרי חלב",
                SortOrder = 1,
                Products = new List<Product>
                {
                    NewProduct("milk-3", "Milk 3%", "חלב 3%", ProductUnit.Carton, 6.90m, "🥛"),
                    NewProduct("milk-1", "Milk 1%", "חלב 1%", ProductUnit.Carton, 6.70m, "🥛"),
                    NewProduct("cottage-cheese", "Cottage Cheese 5%", "קוטג' 5%", ProductUnit.Unit, 7.50m, "🧀"),
                    NewProduct("sour-cream", "Sour Cream 15%", "שמנת חמוצה 15%", ProductUnit.Unit, 5.90m, "🥛"),
                    NewProduct("yellow-cheese", "Yellow Cheese 28%", "גבינה צהובה 28%", ProductUnit.Pack, 24.90m, "🧀"),
                    NewProduct("white-cheese-5", "White Cheese 5%", "גבינה לבנה 5%", ProductUnit.Unit, 6.40m, "🧀"),
                    NewProduct("butter", "Butter 100g", "חמאה 100 גרם", ProductUnit.Pack, 8.90m, "🧈"),
                    NewProduct("natural-yogurt", "Natural Yogurt", "יוגורט טבעי", ProductUnit.Unit, 4.50m, "🥣"),
                    NewProduct("eggs-large", "Eggs L, 12 pack", "ביצים L, מארז 12", ProductUnit.Carton, 14.90m, "🥚")
                }
            },
            new Category
            {
                Slug = "fruits-vegetables",
                NameEn = "Fruits & Vegetables",
                NameHe = "פירות וירקות",
                SortOrder = 2,
                Products = new List<Product>
                {
                    NewProduct("bananas", "Bananas", "בננות", ProductUnit.Kg, 8.90m, "🍌"),
                    NewProduct("tomatoes", "Tomatoes", "עגבניות", ProductUnit.Kg, 6.90m, "🍅"),
                    NewProduct("cucumbers", "Cucumbers", "מלפפונים", ProductUnit.Kg, 5.90m, "🥒"),
                    NewProduct("red-apples", "Red Apples", "תפוחים אדומים", ProductUnit.Kg, 11.90m, "🍎"),
                    NewProduct("avocado", "Avocado", "אבוקדו", ProductUnit.Kg, 14.90m, "🥑"),
                    NewProduct("carrots", "Carrots", "גזר", ProductUnit.Kg, 4.90m, "🥕"),
                    NewProduct("onions", "Onions", "בצל יבש", ProductUnit.Kg, 4.50m, "🧅"),
                    NewProduct("lemons", "Lemons", "לימונים", ProductUnit.Kg, 9.90m, "🍋"),
                    NewProduct("strawberries", "Strawberries", "תותים", ProductUnit.Pack, 16.90m, "🍓"),
                    NewProduct("bell-peppers", "Red Bell Peppers", "פלפל אדום", ProductUnit.Kg, 12.90m, "🫑")
                }
            },
            new Category
            {
                Slug = "meat-fish",
                NameEn = "Meat & Fish",
                NameHe = "בשר ודגים",
                SortOrder = 3,
                Products = new List<Product>
                {
                    NewProduct("ground-beef", "Ground Beef", "בשר בקר טחון", ProductUnit.Kg, 54.90m, "🥩"),
                    NewProduct("entrecote", "Entrecote Steak", "אנטריקוט", ProductUnit.Kg, 129.90m, "🥩"),
                    NewProduct("chicken-breast", "Chicken Breast", "חזה עוף", ProductUnit.Kg, 39.90m, "🍗"),
                    NewProduct("whole-chicken", "Whole Chicken", "עוף שלם", ProductUnit.Kg, 24.90m, "🐔"),
                    NewProduct("salmon-fillet", "Salmon Fillet", "פילה סלמון", ProductUnit.Kg, 89.90m, "🐟"),
                    NewProduct("tilapia", "Tilapia", "אמנון", ProductUnit.Kg, 42.90m, "🐟"),
                    NewProduct("turkey-shawarma", "Turkey Shawarma", "שווארמה הודו", ProductUnit.Kg, 49.90m, "🌯")
                }
            },
            new Category
            {
                Slug = "bakery",
                NameEn = "Bakery",
                NameHe = "מאפים",
                SortOrder = 4,
                Products = new List<Product>
                {
                    NewProduct("white-bread", "Sliced White Bread", "לחם לבן פרוס", ProductUnit.Unit, 7.90m, "🍞"),
                    NewProduct("whole-wheat-bread", "Whole Wheat Bread", "לחם מלא", ProductUnit.Unit, 9.90m, "🍞"),
                    NewProduct("pita", "Pita Bread, 10 pack", "פיתות, מארז 10", ProductUnit.Pack, 12.90m, "🫓"),
                    NewProduct("challah", "Challah", "חלה", ProductUnit.Unit, 13.90m, "🥖"),
                    NewProduct("croissant", "Butter Croissant", "קרואסון חמאה", ProductUnit.Unit, 6.50m, "🥐"),
                    NewProduct("cheese-burekas", "Cheese Burekas", "בורקס גבינה", ProductUnit.Pack, 18.90m, "🥟"),
                    NewProduct("bagel", "Jerusalem Bagel", "בייגל ירושלמי", ProductUnit.Unit, 5.50m, "🥯")
                }
            },
            new Category
            {
                Slug = "beverages",
                NameEn = "Beverages",
                NameHe = "משקאות",
                SortOrder = 5,
                Products = new List<Product>
                {
                    NewProduct("mineral-water", "Mineral Water 1.5L", "מים מינרליים 1.5 ליטר", ProductUnit.Bottle, 4.90m, "💧"),
                    NewProduct("orange-juice", "Orange Juice 1L", "מיץ תפוזים 1 ליטר", ProductUnit.Carton, 12.90m, "🧃"),
                    NewProduct("cola", "Cola 1.5L", "קולה 1.5 ליטר", ProductUnit.Bottle, 8.90m, "🥤"),
                    NewProduct("ground-coffee", "Ground Coffee 200g", "קפה טחון 200 גרם", ProductUnit.Pack, 22.90m, "☕"),
                    NewProduct("black-tea", "Black Tea, 25 bags", "תה שחור, 25 שקיות", ProductUnit.Pack, 14.90m, "🍵"),
                    NewProduct("lager-beer", "Lager Beer", "בירה לאגר", ProductUnit.Bottle, 9.90m, "🍺"),
                    NewProduct("red-wine", "Dry Red Wine", "יין אדום יבש", ProductUnit.Bottle, 49.90m, "🍷")
                }
            },
            new Category
            {
                Slug = "snacks-sweets",
                NameEn = "Snacks & Sweets",
                NameHe = "חטיפים ומתוקים",
                SortOrder = 6,
                Products = new List<Product>
                {
                    NewProduct("milk-chocolate", "Milk Chocolate Bar", "שוקולד חלב", ProductUnit.Unit, 6.90m, "🍫"),
                    NewProduct("bissli", "Bissli Grill", "ביסלי גריל", ProductUnit.Pack, 5.50m, "🥨"),
                    NewProduct("bamba", "Bamba Peanut Snack", "במבה", ProductUnit.Pack, 4.90m, "🥜"),
                    NewProduct("potato-chips", "Potato Chips", "חטיף תפוציפס", ProductUnit.Pack, 9.90m, "🍟"),
                    NewProduct("chocolate-wafers", "Chocolate Wafers", "ופלים בשוקולד", ProductUnit.Pack, 8.90m, "🍪"),
                    NewProduct("vanilla-ice-cream", "Vanilla Ice Cream 1L", "גלידת וניל 1 ליטר", ProductUnit.Unit, 24.90m, "🍨"),
                    NewProduct("halva", "Halva with Pistachio", "חלבה עם פיסטוק", ProductUnit.Pack, 19.90m, "🍬"),
                    NewProduct("pretzels", "Salted Pretzels", "בייגלה מלוח", ProductUnit.Pack, 6.90m, "🥨")
                }
            }
        };
    }

    private static Product NewProduct(
        string slug,
        string nameEn,
        string nameHe,
        ProductUnit unit,
        decimal pricePerUnit,
        string emoji)
    {
        return new Product
        {
            Slug = slug,
            NameEn = nameEn,
            NameHe = nameHe,
            Unit = unit,
            PricePerUnit = pricePerUnit,
            Emoji = emoji,
            IsActive = true
        };
    }
}
