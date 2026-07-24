# Sabito App

Partner / marketer marketplace for businesses that enable **Partner Program** in [African Business Suite (ABS)](https://africanbusinesssuite.com).

Marketers browse partner businesses, apply to partner, and earn commission. Backend will live in ABS; this app is the public web frontend (own domain later). Mobile app can follow the same API later.

> Not the same as Sabito Store (online storefronts) or ABS Sales Agent applications.

## Run locally

```bash
cd sabito-app
npm install
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

## What’s in v1

- Landing: hero, category filters, business cards, stats, reviews, business CTA, FAQ, footer, WhatsApp FAB
- `/login` and `/signup` (stubbed auth)
- `/businesses` marketplace list + `/businesses/[slug]` detail with apply CTA
- Mock marketplace data in `lib/mock-data.ts`

## Next (ABS backend)

- Tenant setting `partnerProgramEnabled`
- Public list endpoint for enabled businesses
- Marketer auth + apply-to-partner flow
- Commission / payout engine (later)

## Env

Copy `.env.example` to `.env.local` as needed.
