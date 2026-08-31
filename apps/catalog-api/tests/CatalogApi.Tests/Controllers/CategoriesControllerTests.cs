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

public class CategoriesControllerTests
{
    private readonly Mock<ICatalogService> _catalogService = new(MockBehavior.Strict);

    private static CategoryDto SampleCategory() => new(
        1,
        "dairy",
        "Dairy",
        "מוצרי חלב",
        1,
        new List<ProductDto>
        {
            new(101, 1, "milk-3", "Milk 3%", "חלב 3%", ProductUnit.Carton, 6.90m, "🥛", true)
        });

    [Fact]
    public async Task GetCategories_Returns200WithServiceResult()
    {
        IReadOnlyList<CategoryDto> expected = new List<CategoryDto> { SampleCategory() };

        _catalogService
            .Setup(s => s.GetCategoriesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var controller = new CategoriesController(_catalogService.Object);

        ActionResult<IReadOnlyList<CategoryDto>> response =
            await controller.GetCategories(CancellationToken.None);

        var ok = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        ok.Value.Should().BeSameAs(expected);

        _catalogService.Verify(s => s.GetCategoriesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetCategories_PassesCancellationTokenThrough()
    {
        using var cts = new CancellationTokenSource();

        _catalogService
            .Setup(s => s.GetCategoriesAsync(cts.Token))
            .ReturnsAsync(new List<CategoryDto>());

        var controller = new CategoriesController(_catalogService.Object);

        await controller.GetCategories(cts.Token);

        _catalogService.Verify(s => s.GetCategoriesAsync(cts.Token), Times.Once);
    }

    [Fact]
    public async Task GetCategoryById_Returns200WithTheCategory()
    {
        CategoryDto expected = SampleCategory();

        _catalogService
            .Setup(s => s.GetCategoryByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var controller = new CategoriesController(_catalogService.Object);

        ActionResult<CategoryDto> response = await controller.GetCategoryById(1, CancellationToken.None);

        var ok = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        ok.Value.Should().BeSameAs(expected);
    }

    [Fact]
    public async Task GetCategoryById_UnknownId_LetsNotFoundExceptionBubbleToTheMiddleware()
    {
        _catalogService
            .Setup(s => s.GetCategoryByIdAsync(99, It.IsAny<CancellationToken>()))
            .ThrowsAsync(NotFoundException.ForCategory(99));

        var controller = new CategoriesController(_catalogService.Object);

        Func<Task> act = async () => await controller.GetCategoryById(99, CancellationToken.None);

        (await act.Should().ThrowAsync<NotFoundException>())
            .WithMessage("Category 99 was not found.");
    }

    [Fact]
    public void Constructor_NullService_Throws()
    {
        Action act = () => _ = new CategoriesController(null!);

        act.Should().Throw<ArgumentNullException>();
    }
}
