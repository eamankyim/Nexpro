# Sabito Storefront

Customer-only storefront app for browsing the Sabito Store marketplace, tenant stores, and public products.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Default dev server: `http://localhost:3002`.

## Environment

- `VITE_API_URL`: Backend API origin, without `/api` at the end.
- `VITE_DASHBOARD_URL`: Merchant dashboard origin used for Login/Register/Open Store links.
- `VITE_STOREFRONT_URL`: Public storefront origin used for deployed link generation. Use `http://localhost:3002` locally.

## Routes

- `/`: Marketplace homepage.
- `/store/:storeSlug`: Shared tenant storefront link, redirects to the storefront view.
- `/store/:storeSlug/products/:productSlug`: Shared product link, redirects to the product view.
- `/stores/:storeSlug`: Tenant storefront view.
- `/stores/:storeSlug/products/:productSlug`: Product detail view.
- `/cart`, `/checkout`, `/track-order`: Coming-soon placeholders until ordering is implemented.

Legacy `/store...` and `/marketplace` URLs redirect into the new customer route shape.

## Build And Deploy

```bash
npm run build
npm run preview
```

### Vercel (sabitostore.com)

1. Create a Vercel project with **Root Directory** = `storefront` (not the monorepo root).
2. Framework preset: **Vite**.
3. `storefront/vercel.json` rewrites all non-asset routes to `index.html` so reloads and deep links work.
4. Set production env vars before build:
   - `VITE_API_URL=https://api.africanbusinesssuite.com`
   - `VITE_STOREFRONT_URL=https://sabitostore.com`
   - `VITE_DASHBOARD_URL=https://myapp.africanbusinesssuite.com`
   - `VITE_GOOGLE_CLIENT_ID=<your Google Web client ID>`
5. Point `sabitostore.com` DNS to this Vercel project.

If you see `404: NOT_FOUND` on refresh or direct URLs, confirm Root Directory is `storefront` and redeploy after `vercel.json` is present.

Deploy this folder as its own Vite app, for example to `sabitostore.com` or `www.absghana.com`, and set `VITE_API_URL` to the production API origin plus `VITE_DASHBOARD_URL` to the merchant dashboard domain.
