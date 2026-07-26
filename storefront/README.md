# Sabito Storefront

Customer storefront app with two product surfaces:

- **Sabito marketplace** — multi-store discovery (`/`, `/stores`, `/products`, …)
- **ABS Online Store** — single-merchant shop (custom domains, `/shop/:slug`, templates gallery)

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Default dev server: `http://localhost:3002` (strict — do not run sabito-app or other apps on this port).

**Online Store template gallery:** `http://localhost:3002/templates`  
**Template preview:** `http://localhost:3002/templates/classic/preview`  
**Live merchant shop:** `http://localhost:3002/shop/:storeSlug`

## Environment

- `VITE_API_URL`: Backend API origin, without `/api` at the end.
- `VITE_DASHBOARD_URL`: Merchant dashboard origin used for Login/Register/Open Store links.
- `VITE_ABS_APP_URL`: ABS merchant app (gallery “Use this template” CTA).
- `VITE_STOREFRONT_URL`: Public storefront origin (Sabito marketplace). Use `http://localhost:3002` locally.
- `VITE_TEMPLATES_HOST`: Hostname that serves the gallery as home (production: `templates.absghana.com`).

ABS Frontend (merchant app) also uses:

- `VITE_TEMPLATES_GALLERY_URL` — gallery base for iframes (defaults to storefront origin locally)
- `VITE_ONLINE_STORE_URL` — Online Store / `/shop/:slug` origin

## Routes

### Sabito marketplace
- `/`: Marketplace homepage.
- `/stores`, `/products`, `/services`, …: Discovery.
- `/stores/:storeSlug`: Marketplace store page (includes Sabito breadcrumb chrome).
- Bare `/shop` redirects to `/products` (marketplace products alias).

### Online Store (single shop)
- `/shop/:storeSlug`: Live Online Store path (single-shop chrome, no marketplace discovery).
- `/templates`: Visual template gallery (no marketplace nav).
- `/templates/:templateId/preview`: Demo brand + sample products.
- `/templates/:templateId/preview-tenant`: Personalized ABS iframe preview.
- Custom domain host: `/` maps to that merchant’s store only.

Legacy `/template/:slug` redirects to `/shop/:slug`.  
Legacy `/store/:slug` redirects into `/stores/:slug` (marketplace browsing).

## Architecture notes

Mode is resolved in `StorefrontModeContext` (`marketplace` | `online-store` | `templates`).  
Single-shop route modules live under `src/online-store/`. Template shells live under `src/templates/`.

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

### ABS Online Store host (store.absghana.com)

**Do not point `www.absghana.com` at this Vite app while it also serves the marketing-site.** Today `www.absghana.com` is the Next.js marketing project; `/shop/:slug` is not a marketing route (that caused production 404s).

Recommended setup:

1. Keep marketing on `www.absghana.com` / `africanbusinesssuite.com`.
2. Attach `store.absghana.com` to **this** storefront Vercel project (and `templates.absghana.com` for the gallery). DNS CNAME `store` → `cname.vercel-dns.com` (or Vercel’s instructed target).
3. Marketing (`marketing-site`) redirects `/shop/*` and `/template/*` to that origin via `NEXT_PUBLIC_ONLINE_STORE_URL` (see `marketing-site/next.config.ts`; fallback is `https://store.absghana.com`).
4. Set Frontend `VITE_ONLINE_STORE_URL` and Backend `ONLINE_STORE_URL` / `STOREFRONT_CNAME_TARGET` to `https://store.absghana.com` / `store.absghana.com` (not the marketing site). Sabito marketplace may keep `STOREFRONT_URL` / `VITE_STOREFRONT_URL` on sabitostore.com.
5. Merchant custom-domain CNAMEs must target the **storefront** host (`store.absghana.com`), not the marketing site (`/login` and `/signup` on marketing already go to the ABS dashboard).

Verify: `https://store.absghana.com/shop/<slug>` returns the SPA `index.html` (200), and after marketing redeploy `https://www.absghana.com/shop/<slug>` 307/308-redirects there.
