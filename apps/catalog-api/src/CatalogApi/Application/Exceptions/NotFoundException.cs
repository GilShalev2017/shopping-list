using System;
using System.Globalization;

namespace CatalogApi.Application.Exceptions;

/// <summary>
/// Thrown by the application layer when a requested resource does not exist.
/// <c>ExceptionHandlingMiddleware</c> turns this into an RFC 7807 404 response.
/// </summary>
public class NotFoundException : Exception
{
    /// <summary>Creates an empty not-found error.</summary>
    public NotFoundException()
        : base("The requested resource was not found.")
    {
    }

    /// <summary>Creates a not-found error with a human readable detail message.</summary>
    /// <param name="message">Detail shown in the ProblemDetails payload.</param>
    public NotFoundException(string message)
        : base(message)
    {
    }

    /// <summary>Creates a not-found error wrapping an inner exception.</summary>
    /// <param name="message">Detail shown in the ProblemDetails payload.</param>
    /// <param name="innerException">The underlying cause.</param>
    public NotFoundException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    /// <summary>
    /// Builds the exact message the contract specifies: "Category 99 was not found."
    /// </summary>
    /// <param name="id">The category id that was requested.</param>
    public static NotFoundException ForCategory(int id) =>
        new(string.Format(CultureInfo.InvariantCulture, "Category {0} was not found.", id));

    /// <summary>Builds a product not-found message.</summary>
    /// <param name="id">The product id that was requested.</param>
    public static NotFoundException ForProduct(int id) =>
        new(string.Format(CultureInfo.InvariantCulture, "Product {0} was not found.", id));
}
