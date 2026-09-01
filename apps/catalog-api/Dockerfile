# Build context is ./apps/catalog-api (see docker-compose.yml at the repo root).
#
#   docker build -t catalog-api ./apps/catalog-api
#   docker run --rm -p 5080:8080 catalog-api

# ---------------------------------------------------------------------------
# 1. restore + publish
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy only what restore needs first so the NuGet layer is cached.
COPY Directory.Build.props ./
COPY src/CatalogApi/CatalogApi.csproj src/CatalogApi/
RUN dotnet restore src/CatalogApi/CatalogApi.csproj

# Then the sources.
COPY src/ src/

# The publish output must contain CatalogApi.xml next to CatalogApi.dll: it is what
# Program.cs feeds to Swagger for the endpoint descriptions and examples. It gets there
# on its own because CatalogApi.csproj sets GenerateDocumentationFile=true, and nothing
# below strips it - there is no PublishDocumentationFile=false, no trimming and no
# single-file publish, and the runtime stage copies /app/publish wholesale. If the file
# ever goes missing the app still starts: the IncludeXmlComments call is guarded by
# File.Exists and simply produces a thinner document.
RUN dotnet publish src/CatalogApi/CatalogApi.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    /p:UseAppHost=false

# ---------------------------------------------------------------------------
# 2. runtime
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# curl is only here so Docker Compose can health-check the service and gate the
# client's start-up on it. Installed before switching to the non-root user.
USER root
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/*

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false \
    Catalog__AutoMigrate=true \
    Catalog__SeedData=true

COPY --from=build /app/publish ./

# $APP_UID is the non-root user (1654) baked into the official .NET runtime images.
USER $APP_UID

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=10 \
  CMD curl -fsS http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "CatalogApi.dll"]
