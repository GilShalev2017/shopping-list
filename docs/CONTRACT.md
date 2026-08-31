# Shared Contract

This file is the single source of truth that all three applications are built against.
If a shape changes here, it changes in every app.

---

## 1. Ports

| Service        | Local (IDE) | Docker (host port) | Container port |
| -------------- | ----------- | ------------------ | -------------- |
| client (dev)   | 5173        | —                  | —              |
| client (nginx) | —           | 8080               | 80             |
| catalog-api    | 5080        | 5080               | 8080           |
| orders-api     | 3000        | 3000               | 3000           |
| SQL Server     | 1433        | 1433               | 1433           |
| Elasticsearch  | 9200        | 9200               | 9200           |
| MongoDB        | 27017       | 27017              | 27017          |

---

## 2. Catalog API (.NET 10) — screen 1 data

Base path: `/api`. All responses `application/json`, camelCase.

### `GET /api/categories`

Returns every category, ordered by `sortOrder`. Products are included so screen 1
can be rendered from a single request on page load (assignment requirement 1).

```jsonc
[
  {
    "id": 1,
    "slug": "dairy",
    "nameEn": "Dairy",
    "nameHe": "מוצרי חלב",
    "sortOrder": 1,
    "products": [
      {
        "id": 101,
        "categoryId": 1,
        "slug": "milk-3",
        "nameEn": "Milk 3%",
        "nameHe": "חלב 3%",
        "unit": "carton",          // enum: unit | kg | pack | bottle | carton
        "pricePerUnit": 6.90,      // decimal(10,2), ILS
        "emoji": "🥛",
        "isActive": true
      }
    ]
  }
]
```

### `GET /api/categories/{id}`

Single category with products. `404` if unknown.

### `GET /api/products?categoryId={id}`

Flat product list. `categoryId` optional; omit for all active products.

### `GET /health`

`{ "status": "healthy", "database": "connected" }`

### Errors

RFC 7807 `application/problem+json`:

```jsonc
{ "type": "...", "title": "Not Found", "status": 404, "detail": "Category 99 was not found." }
```

---

## 3. Orders API (NestJS) — screen 2 persistence

Base path: `/api`.

### `POST /api/orders`

Request — the three required form fields plus the cart from screen 1:

```jsonc
{
  "customer": {
    "fullName": "ישראל ישראלי",   // required, 2..120 chars, must contain 2 words
    "address": "הרצל 10, תל אביב", // required, 5..250 chars
    "email": "israel@example.com"   // required, valid email, <= 200 chars
  },
  "items": [                        // required, 1..100 entries
    {
      "productId": 101,             // required, positive int
      "categoryId": 1,              // required, positive int
      "nameEn": "Milk 3%",          // required
      "nameHe": "חלב 3%",           // required
      "unit": "carton",             // required
      "quantity": 2,                // required, int 1..999
      "unitPrice": 6.90             // required, number >= 0
    }
  ],
  "locale": "he"                    // optional, "he" | "en", defaults to "he"
}
```

Response `201 Created`:

```jsonc
{
  "id": "01J8Z...",                 // server-generated ULID-ish id
  "reference": "ORD-8F3A21",        // short human reference shown on screen
  "customer": { ... },
  "items": [ { ...,"lineTotal": 13.80 } ],
  "itemCount": 2,                   // sum of quantities
  "totalAmount": 13.80,
  "currency": "ILS",
  "locale": "he",
  "status": "confirmed",
  "createdAt": "2026-08-31T12:00:00.000Z"
}
```

Validation failure → `400`:

```jsonc
{ "statusCode": 400, "error": "Bad Request", "message": ["customer.email must be an email"] }
```

### `GET /api/orders/:id` → the order, or `404`.

### `GET /api/orders?limit=20&offset=0` → `{ "total": n, "items": [ ... ] }`, newest first.

### `GET /health` → `{ "status": "ok", "driver": "elasticsearch", "store": "connected" }`

---

## 4. Environment variables

### catalog-api

| Var                             | Default                                                          |
| ------------------------------- | ---------------------------------------------------------------- |
| `ConnectionStrings__CatalogDb`  | `Server=localhost,1433;Database=CatalogDb;User Id=sa;Password=Your_strong_Passw0rd;TrustServerCertificate=True;` |
| `Catalog__AutoMigrate`          | `true`                                                           |
| `Catalog__SeedData`             | `true`                                                           |
| `Cors__AllowedOrigins__0`       | `http://localhost:5173`                                          |

### orders-api

| Var                     | Default                  | Notes                              |
| ----------------------- | ------------------------ | ---------------------------------- |
| `PORT`                  | `3000`                   |                                    |
| `NOSQL_DRIVER`          | `elasticsearch`          | `elasticsearch` \| `mongodb`       |
| `ELASTICSEARCH_NODE`    | `http://localhost:9200`  |                                    |
| `ELASTICSEARCH_INDEX`   | `orders`                 |                                    |
| `ELASTICSEARCH_USERNAME`| _(empty)_                | optional basic auth                |
| `ELASTICSEARCH_PASSWORD`| _(empty)_                |                                    |
| `MONGODB_URI`           | `mongodb://localhost:27017` |                                 |
| `MONGODB_DATABASE`      | `orders`                 |                                    |
| `MONGODB_COLLECTION`    | `orders`                 |                                    |
| `CORS_ORIGINS`          | `http://localhost:5173`  | comma separated                    |

### client

| Var                      | Default                 |
| ------------------------ | ----------------------- |
| `VITE_CATALOG_API_URL`   | `http://localhost:5080` |
| `VITE_ORDERS_API_URL`    | `http://localhost:3000` |
| `VITE_DEFAULT_LOCALE`    | `he`                    |

---

## 5. Client design tokens

Both themes are defined as CSS custom properties on `:root` / `[data-theme="dark"]`.
Layout uses **logical properties only** (`margin-inline-start`, `padding-block`,
`inset-inline-end`, `border-start-start-radius`) so a single stylesheet serves both
LTR and RTL. `dir` is set on `<html>` from the active locale.

| Token                | Light               | Dark                |
| -------------------- | ------------------- | ------------------- |
| `--bg`               | `#f6f7fb`           | `#0d1017`           |
| `--surface`          | `#ffffff`           | `#151a23`           |
| `--surface-raised`   | `#ffffff`           | `#1c2230`           |
| `--border`           | `#e3e6ee`           | `#272e3d`           |
| `--text`             | `#111725`           | `#e8ecf5`           |
| `--text-muted`       | `#5c6579`           | `#95a0b6`           |
| `--brand`            | `#2f5fd8`           | `#6b95ff`           |
| `--brand-contrast`   | `#ffffff`           | `#0d1017`           |
| `--accent`           | `#0f9d76`           | `#2fd6a3`           |
| `--danger`           | `#d13b52`           | `#ff7185`           |
| `--radius`           | `14px`              | `14px`              |
| `--shadow`           | `0 1px 2px rgb(16 24 40 / .06), 0 8px 24px rgb(16 24 40 / .06)` | `0 1px 2px rgb(0 0 0 / .4), 0 8px 24px rgb(0 0 0 / .35)` |

Fonts: `Heebo` for Hebrew, `Inter` for English, both self-hosted-free via a
system-first stack so the app has **no external network dependency**.

---

## 6. Redux state shape (client)

```ts
{
  cart: {
    items: Record<number, CartItem>,   // keyed by productId
    ids: number[],                     // insertion order
    lastAddedId: number | null
  },
  ui: {
    theme: 'light' | 'dark' | 'system',
    locale: 'he' | 'en'
  },
  catalogApi: { /* RTK Query */ },
  ordersApi:  { /* RTK Query */ }
}
```

`cart` and `ui` are persisted to `localStorage` through a typed middleware.
