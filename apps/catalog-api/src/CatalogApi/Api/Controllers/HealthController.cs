using System;
using System.Threading;
using System.Threading.Tasks;
using CatalogApi.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CatalogApi.Api.Controllers;

/// <summary>
/// Liveness and readiness probe. Docker Compose gates the client's start-up on it,
/// and it is the fastest way to tell "the API is down" apart from "the database is down".
/// </summary>
[ApiController]
[Route("health")]
[Produces("application/json")]
public sealed class HealthController : ControllerBase
{
    private readonly CatalogDbContext _dbContext;

    /// <summary>Creates the controller.</summary>
    /// <param name="dbContext">Catalog context, used only for a connectivity probe.</param>
    public HealthController(CatalogDbContext dbContext)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        _dbContext = dbContext;
    }

    /// <summary>
    /// Reports service health and database connectivity.
    /// </summary>
    /// <remarks>
    /// Cheap on purpose: it opens a connection to SQL Server and closes it again, without
    /// touching any table, so it can be polled every few seconds by the Compose health
    /// check without loading the database.
    ///
    /// The status code carries the answer, so a probe never has to parse the body:
    /// <c>200</c> means the API is up and the database answered, <c>503</c> means the API
    /// is up but the database did not. The API deliberately starts, and stays up, when SQL
    /// Server is still warming — reporting <c>503</c> here is far more useful to an operator
    /// than a crash loop.
    ///
    /// Sample request:
    ///
    ///     GET /health
    ///
    /// </remarks>
    /// <param name="cancellationToken">Propagated from the request; aborts the probe with it.</param>
    /// <returns>The health payload, with a status code that mirrors it.</returns>
    /// <response code="200">
    /// Healthy: <c>{ "status": "healthy", "database": "connected" }</c>.
    /// </response>
    /// <response code="503">
    /// The database could not be reached: <c>{ "status": "degraded", "database": "disconnected" }</c>.
    /// The API itself is running.
    /// </response>
    [HttpGet(Name = "GetHealth")]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetHealth(CancellationToken cancellationToken)
    {
        bool connected;

        try
        {
            connected = await _dbContext.Database
                .CanConnectAsync(cancellationToken)
                .ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            connected = false;
        }

        if (connected)
        {
            return Ok(new HealthResponse("healthy", "connected"));
        }

        return StatusCode(
            StatusCodes.Status503ServiceUnavailable,
            new HealthResponse("degraded", "disconnected"));
    }
}

/// <summary>
/// Health payload, exactly <c>{ "status": "healthy", "database": "connected" }</c> as
/// specified in docs/CONTRACT.md section 2.
/// </summary>
/// <example>{"status":"healthy","database":"connected"}</example>
/// <param name="Status">
/// <c>"healthy"</c> when the database answered, <c>"degraded"</c> when it did not.
/// </param>
/// <param name="Database">
/// <c>"connected"</c> or <c>"disconnected"</c> — the outcome of the connectivity probe.
/// </param>
public sealed record HealthResponse(string Status, string Database);
