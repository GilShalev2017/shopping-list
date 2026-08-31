using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CatalogApi.Api.Controllers;
using CatalogApi.Application.Abstractions;
using CatalogApi.Application.Exceptions;
using CatalogApi.Contracts;
using CatalogApi.Domain.Entities;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace CatalogApi.Tests.Controllers;

public class ProductsControllerTests
{
    private readonly Mock<ICatalogService> _catalogService = new(MockBehavior.Strict);

    private static ProductDto SampleProduct(int id = 101, int categoryId = 1) =>
        new(id, categoryId, "milk-3", "Milk 3%", "חלב 3%", ProductUnit.Carton, 6.90m, "🥛", true);

    [Fact]
    public async Task GetProducts_WithoutFilter_Returns200AndAsksServiceForEverything()
    {
        IReadOnlyList<ProductDto> expected = new List<ProductDto> { SampleProduct() };

        _catalogService
            .Setup(s => s.GetProductsAsync(null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var controller = new ProductsController(_catalogService.Object);

        ActionResult<IReadOnlyList<ProductDto>> response =
            await controller.GetProducts(null, CancellationToken.None);

        var ok = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        ok.Value.Should().BeSameAs(expected);

        _catalogService.Verify(s => s.GetProductsAsync(null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetProducts_WithCategoryFilter_ForwardsTheFilter()
    {
        IReadOnlyList<ProductDto> expected = new List<ProductDto> { SampleProduct(201, 2) };

        _catalogService
            .Setup(s => s.GetProductsAsync(2, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var controller = new ProductsController(_catalogService.Object);

        ActionResult<IReadOnlyList<ProductDto>> response =
            await controller.GetProducts(2, CancellationToken.None);

        var ok = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().BeSameAs(expected);

        _catalogService.Verify(s => s.GetProductsAsync(2, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetProducts_EmptyResult_StillReturns200()
    {
        IReadOnlyList<ProductDto> expected = new List<ProductDto>();

        _catalogService
            .Setup(s => s.GetProductsAsync(It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var controller = new ProductsController(_catalogService.Object);

        ActionResult<IReadOnlyList<ProductDto>> response =
            await controller.GetProducts(3, CancellationToken.None);

        var ok = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        ((IReadOnlyList<ProductDto>)ok.Value!).Should().BeEmpty();
    }

    [Fact]
    public async Task GetProducts_UnknownCategory_LetsNotFoundExceptionBubbleToTheMiddleware()
    {
        _catalogService
            .Setup(s => s.GetProductsAsync(4242, It.IsAny<CancellationToken>()))
            .ThrowsAsync(NotFoundException.ForCategory(4242));

        var controller = new ProductsController(_catalogService.Object);

        Func<Task> act = async () => await controller.GetProducts(4242, CancellationToken.None);

        (await act.Should().ThrowAsync<NotFoundException>())
            .WithMessage("Category 4242 was not found.");
    }

    [Fact]
    public void Constructor_NullService_Throws()
    {
        Action act = () => _ = new ProductsController(null!);

        act.Should().Throw<ArgumentNullException>();
    }
}
