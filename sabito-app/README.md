# Sabito App

Partner / marketer marketplace for African Business Suite (ABS).

## Run

```bash
cd sabito-app
npm install
# Optional: point at your ABS API
# export NEXT_PUBLIC_ABS_API_URL=http://localhost:5001/api
npm run dev
```

Open http://localhost:3003

> Port **3002** is reserved for the ABS **storefront** (Online Store + `/templates` gallery).

## Features

- Browse businesses that enabled **Sabito Partners** in ABS
- Marketer signup / login (ABS-backed)
- Apply to partner; track applications, referral codes, earnings
- Commission accrues when customer payment is collected (first vs returning rates)
- Businesses pay marketers outside ABS and mark commissions paid in **Settings → Sabito Partners**

Not the same as Sabito Store (online storefront) or ABS Sales Agents (SaaS growth).
