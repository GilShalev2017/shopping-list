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
/// Flat product access, optionally filtered by category.
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
    /// Active products, optionally narrowed to one category.
    /// </summary>
    /// <param name="categoryId">Optional category filter; omit for every active product.</param>
    /// <param name="cancellationToken">Request cancellation token.</param>
    /// <response code="200">The matching products.</response>
    /// <response code="404">A categoryId was supplied but no such category exists.</response>
    [HttpGet(Name = "GetProducts")]
    [ProducesResponseType(typeof(IReadOnlyList<ProductDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> GetProducts(
        [FromQuery] int? categoryId,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<ProductDto> products =
            await _catalogService.GetProductsAsync(categoryId, cancellationToken).ConfigureAwait(false);

        return Ok(products);
    }
}
