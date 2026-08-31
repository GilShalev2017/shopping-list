using System;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using CatalogApi.Application.Exceptions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace CatalogApi.Api.Middleware;

/// <summary>
/// Converts unhandled exceptions into RFC 7807 <c>application/problem+json</c> responses,
/// so every error the client sees has the same shape (docs/CONTRACT.md section 2).
/// </summary>
public sealed class ExceptionHandlingMiddleware
{
    /// <summary>The media type every error response is written with.</summary>
    public const string ProblemJsonContentType = "application/problem+json";

    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    /// <summary>Creates the middleware.</summary>
    /// <param name="next">Next component in the pipeline.</param>
    /// <param name="logger">Logger.</param>
    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        ArgumentNullException.ThrowIfNull(next);
        ArgumentNullException.ThrowIfNull(logger);

        _next = next;
        _logger = logger;
    }

    /// <summary>Runs the pipeline and traps anything that escapes it.</summary>
    /// <param name="context">The current HTTP context.</param>
    public async Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        try
        {
            await _next(context).ConfigureAwait(false);
        }
        catch (NotFoundException ex)
        {
            _logger.LogInformation("Resource not found: {Message}", ex.Message);

            await WriteProblemAsync(
                context,
                StatusCodes.Status404NotFound,
                "Not Found",
                "https://tools.ietf.org/html/rfc9110#section-15.5.5",
                ex.Message).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client disconnected mid-request. There is nobody left to receive a
            // response, and this is not a server fault, so do not log it as a 500.
            _logger.LogDebug(
                "Request {Method} {Path} was aborted by the client.",
                context.Request.Method,
                context.Request.Path);
        }
        catch (ArgumentException ex) when (ex is not ArgumentNullException)
        {
            _logger.LogWarning(ex, "Bad request.");

            await WriteProblemAsync(
                context,
                StatusCodes.Status400BadRequest,
                "Bad Request",
                "https://tools.ietf.org/html/rfc9110#section-15.5.1",
                ex.Message).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception while processing {Method} {Path}.",
                context.Request.Method, context.Request.Path);

            await WriteProblemAsync(
                context,
                StatusCodes.Status500InternalServerError,
                "Internal Server Error",
                "https://tools.ietf.org/html/rfc9110#section-15.6.1",
                "An unexpected error occurred while processing the request.").ConfigureAwait(false);
        }
    }

    private static async Task WriteProblemAsync(
        HttpContext context,
        int statusCode,
        string title,
        string type,
        string detail)
    {
        if (context.Response.HasStarted)
        {
            // Too late to change the response; swallowing keeps the connection sane.
            return;
        }

        var problem = new ProblemDetails
        {
            Type = type,
            Title = title,
            Status = statusCode,
            Detail = detail,
            Instance = context.Request.Path.Value
        };

        problem.Extensions["traceId"] = context.TraceIdentifier;

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = ProblemJsonContentType;

        string payload = JsonSerializer.Serialize(problem, SerializerOptions);

        await context.Response.WriteAsync(payload).ConfigureAwait(false);
    }
}
