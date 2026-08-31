using System;
using System.Threading;
using System.Threading.Tasks;
using CatalogApi.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CatalogApi.Api.Controllers;

/// <summary>
/// Liveness / readiness probe used by Docker Compose and the client.
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
    /// <param name="cancellationToken">Request cancellation token.</param>
    /// <response code="200">Healthy and connected.</response>
    /// <response code="503">The database cannot be reached.</response>
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
/// Health payload, exactly <c>{ "status": "healthy", "database": "connected" }</c>.
/// </summary>
/// <param name="Status">"healthy" or "degraded".</param>
/// <param name="Database">"connected" or "disconnected".</param>
public sealed record HealthResponse(string Status, string Database);
