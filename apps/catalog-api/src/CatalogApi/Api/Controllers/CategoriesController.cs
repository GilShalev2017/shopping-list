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
/// The shopping catalog, grouped into categories with their products nested inside.
/// This is the endpoint screen 1 is built on: one request returns everything the page
/// needs to render, so the client never has to fan out per category.
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
    /// Returns the whole catalog: every category in display order, each with its
    /// active products embedded.
    /// </summary>
    /// <remarks>
    /// This is the one call screen 1 makes on page load. Categories come back sorted by
    /// <c>sortOrder</c> ascending (then by id, so the order is stable), and each category
    /// carries its own <c>products</c> array — already filtered to the active ones and
    /// ordered by product id — so the client can render the full page without a second
    /// round trip and without any client-side joining.
    ///
    /// The list is never <c>null</c>; an empty catalog is an empty array. A category with
    /// no active products is still returned, with an empty <c>products</c> array, because
    /// screen 1 shows the category chip regardless.
    ///
    /// Every name is present in both languages (<c>nameEn</c> / <c>nameHe</c>); the client
    /// picks by locale rather than asking the API for a translation.
    ///
    /// Sample request:
    ///
    ///     GET /api/categories
    ///
    /// </remarks>
    /// <param name="cancellationToken">
    /// Propagated from the request, so an aborted browser request stops the SQL query too.
    /// </param>
    /// <returns>Every category, ordered by <c>sortOrder</c>, with its active products.</returns>
    /// <response code="200">The full catalog. Always an array, possibly empty.</response>
    /// <response code="500">
    /// Unexpected server-side failure, typically the database being unreachable.
    /// Returned as RFC 7807 <c>application/problem+json</c>.
    /// </response>
    [HttpGet(Name = "GetCategories")]
    [ProducesResponseType(typeof(IReadOnlyList<CategoryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetCategories(CancellationToken cancellationToken)
    {
        IReadOnlyList<CategoryDto> categories =
            await _catalogService.GetCategoriesAsync(cancellationToken).ConfigureAwait(false);

        return Ok(categories);
    }

    /// <summary>
    /// Returns one category by id, with its active products embedded.
    /// </summary>
    /// <remarks>
    /// The same shape as a single element of <c>GET /api/categories</c>. Screen 1 does not
    /// need this call — it already has every category from the list endpoint — but it makes
    /// a category deep-linkable and keeps the resource addressable, which is what a REST
    /// consumer expects to find.
    ///
    /// Products are filtered to the active ones and ordered by id. An inactive-only
    /// category still resolves, with an empty <c>products</c> array; only an unknown id
    /// is a 404.
    ///
    /// Sample request:
    ///
    ///     GET /api/categories/1
    ///
    /// </remarks>
    /// <param name="id">
    /// The category's numeric id, as returned in <c>id</c> by <c>GET /api/categories</c>.
    /// The route only matches integers, so a non-numeric segment never reaches this action.
    /// </param>
    /// <param name="cancellationToken">
    /// Propagated from the request, so an aborted browser request stops the SQL query too.
    /// </param>
    /// <returns>The matching category with its active products.</returns>
    /// <response code="200">The category, with its active products embedded.</response>
    /// <response code="404">
    /// No category has that id. RFC 7807 body, for example
    /// <c>{ "title": "Not Found", "status": 404, "detail": "Category 99 was not found." }</c>.
    /// </response>
    /// <response code="500">
    /// Unexpected server-side failure, typically the database being unreachable.
    /// Returned as RFC 7807 <c>application/problem+json</c>.
    /// </response>
    [HttpGet("{id:int}", Name = "GetCategoryById")]
    [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<CategoryDto>> GetCategoryById(int id, CancellationToken cancellationToken)
    {
        // A missing category surfaces as NotFoundException, which
        // ExceptionHandlingMiddleware renders as an RFC 7807 404.
        CategoryDto category =
            await _catalogService.GetCategoryByIdAsync(id, cancellationToken).ConfigureAwait(false);

        return Ok(category);
    }
}
