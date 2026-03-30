# Marketing Site SEO

Summary of SEO implementation for the Next.js marketing site (`marketing-site/`).

## Implemented

- **Metadata**
  - Root: `metadataBase` (from `NEXT_PUBLIC_SITE_URL`), default title/description, title template `%s | African Business Suite`, Open Graph, Twitter cards, robots (index, follow).
  - Per-route metadata for: `/`, `/pricing`, `/contact`, `/shops`, `/studios`, `/pharmacies`, `/smart-report` (unique title and description per page).

- **Default OG/Twitter image**
  - Dynamic image via `app/opengraph-image.tsx` (Next.js `ImageResponse`), 1200×630, branded with African Business Suite name and tagline.

- **Sitemap**
  - `app/sitemap.ts` – all public routes with `lastModified`, `changeFrequency`, and `priority`. Served at `/sitemap.xml`.

- **Robots**
  - `app/robots.ts` – allow all, sitemap URL. Served at `/robots.txt`.

- **Canonical URLs**
  - Handled via `metadataBase`; relative URLs resolve to the configured site URL.

- **Structured data (JSON-LD)**
  - Organization: name, url, logo, description, sameAs (social), contactPoint (contact page).
  - WebSite: name, url, description, publisher (Organization). Injected in root layout via `components/seo/JsonLd.tsx`.

- **Content/technical**
  - One `h1` per page; Hero image has descriptive `alt="African Business Suite Dashboard"`.

## Environment

Set in production (or `.env.local` for local overrides):

- `NEXT_PUBLIC_SITE_URL` – marketing site base URL (e.g. `https://africanbusinesssuite.com`). Used for canonicals, sitemap, and JSON-LD.
- `NEXT_PUBLIC_APP_URL` – main app URL for signup/login redirects.

See `marketing-site/.env.example`.

## Adding new pages

1. Create the page under `app/<route>/`.
2. Add metadata: export `metadata` from a server page, or add `app/<route>/layout.tsx` with `metadata` for client pages.
3. Add the route to `app/sitemap.ts` in the `routes` array (path, priority, changeFrequency).

## Optional later

- Add `/about`, `/blog`, `/privacy`, `/terms` (linked from footer); then add to sitemap and metadata.
- Replace placeholder social URLs in JSON-LD and Footer with real profiles.
- Add a logo at `public/logo.png` for JSON-LD Organization and general use.
- Google Search Console / Bing verification meta tags when verification codes are available.
