using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CatalogApi.Application.Abstractions;
using CatalogApi.Contracts;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CatalogApi.Api.Controllers;

/// <summary>
/// The same catalog data as a flat product list, optionally narrowed to one category.
/// Useful for search, price lookups and any caller that does not want the nested
/// category shape screen 1 uses.
/// </summary>
[ApiController]
[Route("api/products")]
[Produces("application/json")]
public sealed class ProductsController : ControllerBase
{
    private readonly ICatalogService _catalogService;

    /// <summary>Creates the controller.</summary>
    /// <param name="catalogService">Catalog read model.</param>
    public ProductsController(ICatalogService catalogService)
    {
        ArgumentNullException.ThrowIfNull(catalogService);
        _catalogService = catalogService;
    }

    /// <summary>
    /// Returns active products as a flat array, optionally filtered to a single category.
    /// </summary>
    /// <remarks>
    /// Screen 1 does not call this — it gets everything from <c>GET /api/categories</c> in
    /// one request — but the flat projection is the natural shape for anything that works
    /// with products rather than with the page layout: a search box, a price check, or a
    /// second screen that already knows which category it is showing.
    ///
    /// Results are ordered by <c>categoryId</c> then <c>id</c>, so the order is stable
    /// across calls. Inactive products are never returned, with or without a filter.
    ///
    /// A category that exists but has no active products is not an error: the response is
    /// <c>200</c> with an empty array. Only an unknown <c>categoryId</c> is a <c>404</c>,
    /// which is a deliberate choice — silently returning an empty list for a typo'd id
    /// hides client bugs.
    ///
    /// Sample requests:
    ///
    ///     GET /api/products
    ///     GET /api/products?categoryId=1
    ///
    /// </remarks>
    /// <param name="categoryId">
    /// Optional filter. Supply a category id to get only that category's active products;
    /// omit it entirely to get every active product in the catalog.
    /// </param>
    /// <param name="cancellationToken">
    /// Propagated from the request, so an aborted browser request stops the SQL query too.
    /// </param>
    /// <returns>The matching active products, ordered by category then id.</returns>
    /// <response code="200">The matching products. Always an array, possibly empty.</response>
    /// <response code="404">
    /// A <c>categoryId</c> was supplied but no category has that id. RFC 7807 body, for
    /// example <c>{ "title": "Not Found", "status": 404, "detail": "Category 99 was not found." }</c>.
    /// </response>
    /// <response code="500">
    /// Unexpected server-side failure, typically the database being unreachable.
    /// Returned as RFC 7807 <c>application/problem+json</c>.
    /// </response>
    [HttpGet(Name = "GetProducts")]
    [ProducesResponseType(typeof(IReadOnlyList<ProductDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> GetProducts(
        [FromQuery] int? categoryId,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<ProductDto> products =
            await _catalogService.GetProductsAsync(categoryId, cancellationToken).ConfigureAwait(false);

        return Ok(products);
    }
}
