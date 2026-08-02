# Sabito

Marketer web app for African Business Suite **Sabito Partners** — aligned with `sabito-mobile`.

## Product model

1. Sign up as a marketer  
2. Apply to businesses that enabled Sabito Partners  
3. Submit referrals with client **email or phone** (ABS matches customers)  
4. Earn when payment is collected  
5. **Request cashout** → business pays MoMo/bank → marks paid in ABS Settings → Sabito Partners  

## Run

```bash
cd sabito-app
npm install
# Optional: NEXT_PUBLIC_ABS_API_URL=http://localhost:5001/api
npm run dev
```

Open http://localhost:3003

## App routes (parity with mobile)

| Route | Purpose |
|-------|---------|
| `/` | Marketing landing |
| `/businesses` | Marketplace |
| `/login`, `/signup` | Auth |
| `/dashboard` | Home / stats |
| `/referrals`, `/referrals/[id]` | Create + list + detail |
| `/earnings`, `/cashout` | Commissions + cashout request |
| `/account` | Profile + MoMo |
| `/activities`, `/help` | Activity feed + support |

Not Sabito Store (storefront) and not ABS Sales Agents (`marketing-site/sales-agent`).
