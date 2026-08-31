using CatalogApi.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CatalogApi.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Product"/>.
/// </summary>
public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Products");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .ValueGeneratedOnAdd();

        builder.Property(p => p.Slug)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(p => p.NameEn)
            .IsRequired()
            .HasMaxLength(128);

        builder.Property(p => p.NameHe)
            .IsRequired()
            .HasMaxLength(128);

        // Stored as its name ("Carton") rather than an int, so the table stays readable
        // and adding enum members can never silently re-map existing rows.
        builder.Property(p => p.Unit)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(16);

        // decimal(10,2) on SQL Server.
        builder.Property(p => p.PricePerUnit)
            .IsRequired()
            .HasPrecision(10, 2);

        builder.Property(p => p.Emoji)
            .IsRequired()
            .HasMaxLength(16);

        builder.Property(p => p.IsActive)
            .IsRequired();

        builder.HasIndex(p => p.Slug)
            .IsUnique();

        builder.HasIndex(p => p.CategoryId);

        builder.HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
