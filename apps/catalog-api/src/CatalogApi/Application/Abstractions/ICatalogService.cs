using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CatalogApi.Contracts;

namespace CatalogApi.Application.Abstractions;

/// <summary>
/// Read model for screen 1. The controllers depend on this abstraction only,
/// which is what makes the controller tests pure unit tests.
/// </summary>
public interface ICatalogService
{
    /// <summary>
    /// Every category ordered by <c>SortOrder</c>, each with its active products.
    /// </summary>
    /// <param name="cancellationToken">Request cancellation token.</param>
    Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// A single category with its active products.
    /// </summary>
    /// <param name="id">Category id.</param>
    /// <param name="cancellationToken">Request cancellation token.</param>
    /// <exception cref="Exceptions.NotFoundException">No category with that id exists.</exception>
    Task<CategoryDto> GetCategoryByIdAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>
    /// A flat list of active products, optionally narrowed to one category.
    /// </summary>
    /// <param name="categoryId">Optional category filter; <c>null</c> returns every active product.</param>
    /// <param name="cancellationToken">Request cancellation token.</param>
    /// <exception cref="Exceptions.NotFoundException">
    /// A <paramref name="categoryId"/> was supplied but no such category exists.
    /// </exception>
    Task<IReadOnlyList<ProductDto>> GetProductsAsync(int? categoryId, CancellationToken cancellationToken = default);
}
