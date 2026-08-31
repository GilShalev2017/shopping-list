# Client — React 19 + Redux Toolkit

The single-page app that renders both assignment screens. It talks to two
different backends: the .NET catalog service for screen 1 and the NestJS orders
service for screen 2.

## Stack

| Concern       | Choice                              | Why                                                                 |
| ------------- | ----------------------------------- | ------------------------------------------------------------------- |
| Build         | Vite 6                              | Fast dev server, native ESM, no config sprawl                        |
| UI            | React 19                            | Required by the assignment                                           |
| State         | Redux Toolkit 2                     | Required by the assignment                                           |
| Server state  | RTK Query                           | Caching, dedupe and loading/error flags without hand-rolled thunks   |
| Routing       | React Router 7                      | Two screens plus a receipt route                                     |
| i18n          | i18next + react-i18next             | Hebrew and English, with plural rules                                |
| Styling       | CSS Modules + custom properties     | Full control over RTL and theming, zero runtime cost                 |
| Tests         | Vitest + Testing Library + MSW      | Same wiring as production, network mocked at the HTTP layer          |

## Running

```bash
npm install
cp .env.example .env    # optional; the defaults already point at localhost
npm run dev             # http://localhost:5173
```

The two APIs must be reachable. From the repository root, `docker compose up -d`
starts the databases and `docker compose --profile apps up -d` starts everything.

| Script            | Does                                       |
| ----------------- | ------------------------------------------ |
| `npm run dev`     | Dev server with HMR on port 5173           |
| `npm run build`   | Type-check then emit `dist/`               |
| `npm run preview` | Serve the built bundle on 4173             |
| `npm run lint`    | ESLint (flat config, type-aware rules)     |
| `npm test`        | Run the suite once                         |
| `npm run test:cov`| Run with coverage and enforce thresholds   |

## Environment

Vite inlines `import.meta.env` at build time, so these are build-time values:

| Var                    | Default                 |
| ---------------------- | ----------------------- |
| `VITE_CATALOG_API_URL` | `http://localhost:5080` |
| `VITE_ORDERS_API_URL`  | `http://localhost:3000` |
| `VITE_DEFAULT_LOCALE`  | `he`                    |

## Architecture

```
src/
├── app/            store, typed hooks, localStorage persistence middleware
├── features/
│   ├── catalog/    RTK Query slice + the picker and grid components
│   ├── cart/       cartSlice (the only client-owned domain state) + CartPanel
│   ├── orders/     RTK Query slice + pure form validation
│   └── ui/         theme/locale slice + the hook that reflects it onto <html>
├── components/     presentational primitives (Button, Card, Field, …)
├── pages/          one file per route
├── i18n/           i18next setup and the two translation bundles
├── lib/            formatting helpers
└── test/           MSW handlers, fixtures, provider-aware render helper
```

### State ownership

Two kinds of state, deliberately kept apart:

- **Server state** (categories, products, orders) lives in RTK Query. It is
  cached, deduplicated and invalidated by tag; no reducer ever copies it.
- **Client state** (the cart, the theme, the language) lives in plain slices.

The cart is keyed by `productId` with a parallel `ids` array for stable
insertion order, so adding the same product twice increments one line instead of
creating a duplicate, and every quantity update is O(1). Totals are derived with
memoised `createSelector`s rather than stored, so they can never drift from the
items.

Cart and UI state are persisted to `localStorage` by a listener middleware.
Everything read back is validated field by field — a corrupted or hand-edited
entry degrades to an empty cart rather than crashing the app.

### Theming

Every colour is a CSS custom property defined once on `:root` and overridden in
one `[data-theme="dark"]` block. `useAppearance` writes `data-theme` onto
`<html>`; in `system` mode it subscribes to `prefers-color-scheme` and follows
the OS live. A tiny inline script in `index.html` applies the persisted theme
before first paint, so there is no flash of the wrong palette on reload.

### Right-to-left

There is one stylesheet, not two. Every rule uses **logical properties**
(`margin-inline-start`, `padding-block`, `inset-inline-end`, `text-align: start`)
rather than physical `left`/`right`, so switching `dir` on `<html>` mirrors the
whole layout correctly. Only two rules key off direction explicitly: the select
chevron's background position and the back-arrow glyph, both of which are
genuinely directional. Numbers and the email field are wrapped in `direction: ltr`
isolation so prices and addresses do not scramble inside Hebrew text.

Product and category names arrive from the API in both languages (`nameHe` /
`nameEn`) and are picked by `localizedName(entity, locale)`, so switching
language re-labels the catalog without a refetch.

## Testing

289 tests, 100% statement and line coverage, thresholds enforced in
`vite.config.ts`.

The tests render components inside the real provider stack — a real store, real
i18next, real router — and mock only the network, at the HTTP boundary, with
MSW. That means a test failure points at a real defect rather than at a stale
mock. `src/App.test.tsx` walks the full journey: load the catalog, add products
through both flows, fill the form, submit, and assert on the exact payload the
orders API received.

`src/i18n/i18n.test.ts` guards the translation bundles: every key must exist in
both languages, no string may be empty, and interpolation placeholders must
match across locales. A forgotten Hebrew translation is a failing test.
