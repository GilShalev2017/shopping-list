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
/// Categories with their products — the single request screen 1 loads from.
/// </summary>
[ApiController]
[Route("api/categories")]
[Produces("application/json")]
public sealed class CategoriesController : ControllerBase
{
    private readonly ICatalogService _catalogService;

    /// <summary>Creates the controller.</summary>
    /// <param name="catalogService">Catalog read model.</param>
    public CategoriesController(ICatalogService catalogService)
    {
        ArgumentNullException.ThrowIfNull(catalogService);
        _catalogService = catalogService;
    }

    /// <summary>
    /// Every category ordered by <c>sortOrder</c>, each with its active products.
    /// </summary>
    /// <param name="cancellationToken">Request cancellation token.</param>
    /// <response code="200">The full catalog.</response>
    [HttpGet(Name = "GetCategories")]
    [ProducesResponseType(typeof(IReadOnlyList<CategoryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetCategories(CancellationToken cancellationToken)
    {
        IReadOnlyList<CategoryDto> categories =
            await _catalogService.GetCategoriesAsync(cancellationToken).ConfigureAwait(false);

        return Ok(categories);
    }

    /// <summary>
    /// A single category with its active products.
    /// </summary>
    /// <param name="id">Category id.</param>
    /// <param name="cancellationToken">Request cancellation token.</param>
    /// <response code="200">The category.</response>
    /// <response code="404">No category with that id.</response>
    [HttpGet("{id:int}", Name = "GetCategoryById")]
    [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CategoryDto>> GetCategoryById(int id, CancellationToken cancellationToken)
    {
        // A missing category surfaces as NotFoundException, which
        // ExceptionHandlingMiddleware renders as an RFC 7807 404.
        CategoryDto category =
            await _catalogService.GetCategoryByIdAsync(id, cancellationToken).ConfigureAwait(false);

        return Ok(category);
    }
}
