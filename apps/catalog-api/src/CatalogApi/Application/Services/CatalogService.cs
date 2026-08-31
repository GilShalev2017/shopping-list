using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CatalogApi.Application.Abstractions;
using CatalogApi.Application.Exceptions;
using CatalogApi.Contracts;
using CatalogApi.Contracts.Mapping;
using CatalogApi.Domain.Entities;
using CatalogApi.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CatalogApi.Application.Services;

/// <summary>
/// EF Core backed implementation of <see cref="ICatalogService"/>.
/// </summary>
/// <remarks>
/// Categories and products are fetched with two flat, provider-agnostic queries and
/// stitched together in memory instead of using a filtered <c>Include</c>. That keeps
/// the SQL simple (two indexed reads, no cartesian explosion) and keeps the exact same
/// code path working under the in-memory provider used by the tests.
/// </remarks>
public sealed class CatalogService : ICatalogService
{
    private readonly CatalogDbContext _dbContext;

    /// <summary>Creates the service.</summary>
    /// <param name="dbContext">The catalog database context.</param>
    public CatalogService(CatalogDbContext dbContext)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken = default)
    {
        List<Category> categories = await _dbContext.Categories
            .AsNoTracking()
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        List<Product> products = await _dbContext.Products
            .AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.CategoryId)
            .ThenBy(p => p.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        Dictionary<int, List<Product>> byCategory = products
            .GroupBy(p => p.CategoryId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = new List<CategoryDto>(categories.Count);
        foreach (Category category in categories)
        {
            IEnumerable<Product> items = byCategory.TryGetValue(category.Id, out List<Product>? found)
                ? found
                : new List<Product>();

            result.Add(category.ToDto(items));
        }

        return result;
    }

    /// <inheritdoc />
    public async Task<CategoryDto> GetCategoryByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        Category? category = await _dbContext.Categories
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken)
            .ConfigureAwait(false);

        if (category is null)
        {
            throw NotFoundException.ForCategory(id);
        }

        List<Product> products = await _dbContext.Products
            .AsNoTracking()
            .Where(p => p.CategoryId == id && p.IsActive)
            .OrderBy(p => p.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return category.ToDto(products);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<ProductDto>> GetProductsAsync(
        int? categoryId,
        CancellationToken cancellationToken = default)
    {
        IQueryable<Product> query = _dbContext.Products
            .AsNoTracking()
            .Where(p => p.IsActive);

        if (categoryId.HasValue)
        {
            int filterId = categoryId.Value;

            bool categoryExists = await _dbContext.Categories
                .AsNoTracking()
                .AnyAsync(c => c.Id == filterId, cancellationToken)
                .ConfigureAwait(false);

            if (!categoryExists)
            {
                throw NotFoundException.ForCategory(filterId);
            }

            query = query.Where(p => p.CategoryId == filterId);
        }

        List<Product> products = await query
            .OrderBy(p => p.CategoryId)
            .ThenBy(p => p.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return products.ToDtoList();
    }
}
