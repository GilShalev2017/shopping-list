using CatalogApi.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CatalogApi.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Category"/>.
/// </summary>
public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .ValueGeneratedOnAdd();

        builder.Property(c => c.Slug)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(c => c.NameEn)
            .IsRequired()
            .HasMaxLength(128);

        builder.Property(c => c.NameHe)
            .IsRequired()
            .HasMaxLength(128);

        builder.Property(c => c.SortOrder)
            .IsRequired();

        builder.HasIndex(c => c.Slug)
            .IsUnique();

        builder.HasIndex(c => c.SortOrder);

        // Products are configured from the dependent side (ProductConfiguration),
        // which also sets the cascade delete behaviour.
    }
}
