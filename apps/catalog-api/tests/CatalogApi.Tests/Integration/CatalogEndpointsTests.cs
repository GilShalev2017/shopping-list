using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using CatalogApi.Contracts;
using CatalogApi.Domain.Entities;
using CatalogApi.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CatalogApi.Tests.Integration;

/// <summary>
/// Boots the real Program pipeline (controllers, JSON options, CORS, exception
/// middleware) and swaps only the EF Core provider for the in-memory one, so the
/// suite needs no SQL Server.
/// </summary>
public sealed class CatalogApiFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = "catalog-integration-" + Guid.NewGuid().ToString("N");
    private readonly object _seedGate = new();

    private bool _seeded;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // The real start-up hook must not try to reach SQL Server; this suite seeds itself.
        // ConfigureAppConfiguration (rather than UseSetting) so these win over appsettings.json.
        builder.ConfigureAppConfiguration(configuration =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Catalog:AutoMigrate"] = "false",
                ["Catalog:SeedData"] = "false",
                ["Cors:AllowedOrigins:0"] = "http://localhost:5173"
            });
        });

        builder.ConfigureServices(services =>
        {
            // Drop every SQL Server registration AddDbContext made, including the
            // IDbContextOptionsConfiguration<CatalogDbContext> that would otherwise
            // re-apply UseSqlServer on top of the in-memory provider.
            List<ServiceDescriptor> toRemove = services
                .Where(d =>
                    d.ServiceType == typeof(CatalogDbContext) ||
                    d.ServiceType == typeof(DbContextOptions) ||
                    d.ServiceType == typeof(DbContextOptions<CatalogDbContext>) ||
                    (d.ServiceType.FullName is not null &&
                     d.ServiceType.FullName.Contains("IDbContextOptionsConfiguration", StringComparison.Ordinal)))
                .ToList();

            foreach (ServiceDescriptor descriptor in toRemove)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<CatalogDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName));
        });
    }

    /// <summary>
    /// Creates the schema and inserts the production seed data exactly once for the
    /// whole fixture. Synchronous on purpose so the test class constructor can call it.
    /// </summary>
    public void EnsureSeeded()
    {
        lock (_seedGate)
        {
            if (_seeded)
            {
                return;
            }

            using IServiceScope scope = Services.CreateScope();

            CatalogDbContext context = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();

            context.Database.EnsureCreated();
            CatalogSeeder.SeedAsync(context).GetAwaiter().GetResult();

            _seeded = true;
        }
    }
}

public sealed class CatalogEndpointsTests : IClassFixture<CatalogApiFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();

    private readonly CatalogApiFactory _factory;

    public CatalogEndpointsTests(CatalogApiFactory factory)
    {
        _factory = factory;
        _factory.EnsureSeeded();
    }

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        return options;
    }

    [Fact]
    public async Task GetHealth_ReturnsHealthyAndConnected()
    {
        using HttpClient client = _factory.CreateClient();

        using HttpResponseMessage response = await client.GetAsync("/health");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using JsonDocument document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        document.RootElement.GetProperty("status").GetString().Should().Be("healthy");
        document.RootElement.GetProperty("database").GetString().Should().Be("connected");
    }

    [Fact]
    public async Task GetCategories_Returns200WithTheWholeCatalog()
    {
        using HttpClient client = _factory.CreateClient();

        using HttpResponseMessage response = await client.GetAsync("/api/categories");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/json");

        List<CategoryDto>? categories =
            await response.Content.ReadFromJsonAsync<List<CategoryDto>>(JsonOptions);

        categories.Should().NotBeNull();
        categories!.Count.Should().BeGreaterThanOrEqualTo(6);
        categories.Select(c => c.SortOrder).Should().BeInAscendingOrder();
        categories.Should().OnlyContain(c => c.Products.Count > 0);
        categories.SelectMany(c => c.Products).Count().Should().BeGreaterThanOrEqualTo(30);
    }

    [Fact]
    public async Task GetCategories_SerialisesUnitAsALowercaseContractString()
    {
        using HttpClient client = _factory.CreateClient();

        string json = await client.GetStringAsync("/api/categories");

        json.Should().Contain("\"unit\":\"carton\"");
        json.Should().Contain("\"nameHe\":");
        json.Should().Contain("\"pricePerUnit\":");
        json.Should().NotContain("\"Unit\":");
        json.Should().NotContain("\"NameHe\":");
    }

    [Fact]
    public async Task GetCategoryById_Returns200ForAKnownCategory()
    {
        using HttpClient client = _factory.CreateClient();

        List<CategoryDto>? all =
            await client.GetFromJsonAsync<List<CategoryDto>>("/api/categories", JsonOptions);

        all.Should().NotBeNull();
        CategoryDto first = all![0];

        CategoryDto? single =
            await client.GetFromJsonAsync<CategoryDto>("/api/categories/" + first.Id, JsonOptions);

        single.Should().NotBeNull();
        single!.Id.Should().Be(first.Id);
        single.Slug.Should().Be(first.Slug);
        single.Products.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetCategoryById_Returns404ProblemDetailsForUnknownCategory()
    {
        using HttpClient client = _factory.CreateClient();

        using HttpResponseMessage response = await client.GetAsync("/api/categories/99999");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");

        ProblemDetails? problem =
            await response.Content.ReadFromJsonAsync<ProblemDetails>(JsonOptions);

        problem.Should().NotBeNull();
        problem!.Status.Should().Be(404);
        problem.Title.Should().Be("Not Found");
        problem.Detail.Should().Be("Category 99999 was not found.");
    }

    [Fact]
    public async Task GetProducts_WithoutFilter_ReturnsEveryActiveProduct()
    {
        using HttpClient client = _factory.CreateClient();

        List<ProductDto>? products =
            await client.GetFromJsonAsync<List<ProductDto>>("/api/products", JsonOptions);

        products.Should().NotBeNull();
        products!.Count.Should().BeGreaterThanOrEqualTo(30);
        products.Should().OnlyContain(p => p.IsActive);
        products.Should().OnlyContain(p => p.PricePerUnit > 0m);
        products.Select(p => p.Slug).Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public async Task GetProducts_WithCategoryFilter_ReturnsOnlyThatCategory()
    {
        using HttpClient client = _factory.CreateClient();

        List<CategoryDto>? all =
            await client.GetFromJsonAsync<List<CategoryDto>>("/api/categories", JsonOptions);

        CategoryDto dairy = all!.Single(c => c.Slug == "dairy");

        List<ProductDto>? products = await client.GetFromJsonAsync<List<ProductDto>>(
            "/api/products?categoryId=" + dairy.Id,
            JsonOptions);

        products.Should().NotBeNull();
        products!.Should().NotBeEmpty();
        products.Should().OnlyContain(p => p.CategoryId == dairy.Id);
        products.Select(p => p.Id).Should().BeEquivalentTo(dairy.Products.Select(p => p.Id));
    }

    [Fact]
    public async Task GetProducts_UnknownCategory_Returns404ProblemDetails()
    {
        using HttpClient client = _factory.CreateClient();

        using HttpResponseMessage response = await client.GetAsync("/api/products?categoryId=99999");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
    }

    [Fact]
    public async Task GetCategoryById_NonNumericId_Returns404FromRouting()
    {
        using HttpClient client = _factory.CreateClient();

        using HttpResponseMessage response = await client.GetAsync("/api/categories/not-a-number");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Cors_AllowsTheConfiguredClientOrigin()
    {
        using HttpClient client = _factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/categories");
        request.Headers.Add("Origin", "http://localhost:5173");

        using HttpResponseMessage response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.Contains("Access-Control-Allow-Origin").Should().BeTrue();
    }

    [Fact]
    public async Task ProductUnits_AreAllWithinTheContractEnum()
    {
        using HttpClient client = _factory.CreateClient();

        List<ProductDto>? products =
            await client.GetFromJsonAsync<List<ProductDto>>("/api/products", JsonOptions);

        IReadOnlyList<ProductUnit> allowed = new[]
        {
            ProductUnit.Unit, ProductUnit.Kg, ProductUnit.Pack, ProductUnit.Bottle, ProductUnit.Carton
        };

        products!.Should().OnlyContain(p => allowed.Contains(p.Unit));
    }
}
