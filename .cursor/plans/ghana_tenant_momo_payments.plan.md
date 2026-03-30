---
name: Ghana tenant MoMo payments
overview: Ghana-only customer payments via MTN MoMo, AirtelTigo Money, and Vodafone Cash, with funds collected into each tenant’s own MoMo merchant wallet using per-tenant API credentials (your chosen model).
todos:
  - id: tenant-settings-schema
    content: Design encrypted per-tenant MoMo credentials + Ghana operator flags (MTN, AirtelTigo, VodaCash); document env vs DB fields
  - id: mtn-tenant-scoped
    content: Refactor or wrap MTN Collection flow to use tenant-stored subscription key / API user / key (not single global env)
  - id: airteltigo-ghana
    content: Confirm Ghana AirtelTigo Money API vs existing Airtel OpenAPI; align base URL, auth, and collection contract
  - id: vodafone-cash-ghana
    content: Add Vodafone Cash Ghana merchant/collection integration (new service module + routes + webhooks)
  - id: webhooks-routing
    content: Route operator webhooks to correct tenant/sale (reference IDs, callback secrets per tenant); idempotent updates
  - id: onboarding-ux
    content: Settings UI for tenants to connect MoMo APIs (test/save, mask secrets, optional sandbox); POS/PayInvoice/Checkout wiring per below
  - id: frontend-momo-ghana
    content: Update provider list (MTN, AirtelTigo, Vodafone Cash), sale/invoice API calls, and Paystack-only surfaces (card vs MoMo split)
  - id: paystack-scope
    content: Keep Paystack only for card rails if needed; MoMo customer flows use tenant MoMo APIs in Ghana
---

# Ghana: tenant-direct MoMo (MTN, AirtelTigo, VodaCash)

## Product goal

- **Market:** Ghana only (for now).
- **Operators:** MTN Mobile Money, AirtelTigo Money, Vodafone Cash.
- **Settlement:** Customers pay so money appears **in the tenant’s MoMo merchant account**, as fast as the operator allows (typically near real-time once the customer approves on their phone).
- **Chosen model:** **Per-tenant MoMo Business / API credentials** — each workspace stores its own operator keys; your backend uses those keys to initiate collection so settlement is to **that** tenant, not a platform pool.

## Why this model fits “they see it instantly”

When collection is initiated with **the tenant’s** registered merchant credentials, notifications and wallet balance updates are **the tenant’s** on MTN/AirtelTigo/Vodafone apps—aligned with “instantly” from the merchant’s perspective.

Tradeoffs you accept (worth it if brand trust and regulatory clarity matter):

- **Onboarding friction:** Each tenant must complete MoMo Business / developer access per operator they enable.
- **Security burden:** Secrets must be **encrypted at rest**, never sent to the browser, rotated on compromise, and access-controlled (e.g. workspace admin only).
- **Support surface:** Wrong keys, expired credentials, or sandbox vs production mix-ups become tenant-specific tickets.

## Current codebase (baseline)

- [Backend/services/mobileMoneyService.js](Backend/services/mobileMoneyService.js) — MTN MoMo Collection + Airtel-style config; today reads **global** `process.env` for MTN/Airtel.
- [Backend/controllers/mobileMoneyController.js](Backend/controllers/mobileMoneyController.js) — initiation, status, webhooks.
- **Gap:** No **Vodafone Cash** Ghana module yet.
- **Gap:** Credentials are not **tenant-scoped**; must be extended for your chosen model.

## Implementation direction (high level)

1. **Tenant settings model**  
   - Store per-tenant, per-operator flags: `mtnEnabled`, `airteltigoEnabled`, `vodafoneEnabled`.  
   - Store **encrypted** credential blobs (e.g. MTN subscription key, API user, API key; AirtelTigo client id/secret or whatever Ghana API requires; Vodafone merchant credentials per their Ghana docs).  
   - Optional: `callbackSecret` per tenant for webhook verification if operators support it.

2. **Request path**  
   - Resolve `tenantId` from auth/context.  
   - Load decrypted credentials for the chosen operator only in the payment service layer (short-lived in memory).  
   - Call the same MTN/Airtel/Vodafone collection primitives you have or add, parameterized by tenant config.

3. **Webhooks**  
   - Either **one** endpoint that identifies tenant via `externalId` / reference mapping in DB, or operator-specific URLs including a tenant slug (only if operators allow dynamic callback URLs—often they don’t).  
   - Prefer: **single webhook URL** + **reference → sale/invoice + tenant** lookup; verify signatures with **tenant-specific** secret when the operator supports it.

4. **Ghana-specific verification**  
   - **AirtelTigo:** Confirm whether Ghana uses the same “Airtel Africa OpenAPI” stack as your current [AIRTEL_CONFIG](Backend/services/mobileMoneyService.js) or a different Ghana hub; adjust base URL and auth before go-live.  
   - **Vodafone Cash:** New integration path from operator documentation (Ghana merchant API).

5. **Paystack**  
   - Keep for **card** (if you still offer it); **MoMo in Ghana** for invoices/POS should prefer **tenant MoMo APIs** once credentials exist.

## Customer UX (unchanged in spirit)

- Pick operator → enter MoMo number → approve on phone → app shows success/pending from polling + webhook.  
- Copy should say payments go to **their business** (true with tenant keys).

## Frontend: what changes

Secrets (API keys, subscription keys) **never** ship to the browser. The frontend only collects **non-secret** inputs and calls your backend; UI work is mostly **settings**, **provider labels**, and **which API endpoints** the app hits.

| Area | Likely changes |
|------|----------------|
| [Frontend/src/pages/Settings.jsx](Frontend/src/pages/Settings.jsx) | Extend **payment collection** beyond `momo_phone` / `momo_provider`: forms to enable each Ghana operator, paste/save credentials (send once to API), show **masked** values and “connected” state, validation errors from backend. Ghana operator enum: **MTN, AirtelTigo, Vodafone Cash** (drop or hide **Telecel** if Ghana-only). |
| [Frontend/src/components/pos/POSPaymentModal.jsx](Frontend/src/components/pos/POSPaymentModal.jsx) | Update `MOBILE_MONEY_PROVIDERS` (add **Vodafone Cash**, align naming with Ghana). MoMo tab UX stays similar; primary change is **which handler** runs (direct MoMo initiation via backend using tenant keys, not Paystack MoMo). |
| [Frontend/src/pages/POS.jsx](Frontend/src/pages/POS.jsx) | Replace or branch **`paystackMobileMoneyPay`** flow so online MoMo calls a **tenant-scoped** backend route (e.g. existing `/mobile-money` or new `/sales/:id/momo-collect`). Keep **manual/offline MoMo** and polling/WebSocket success behavior; adjust **check-paystack-charge** if success detection moves to MoMo status endpoint. |
| [Frontend/src/services/saleService.js](Frontend/src/services/saleService.js) | Add or swap methods: **initiate MoMo collection** (sale), **poll status**; keep **Paystack** helpers only for **card** (and any non-Ghana paths if applicable). |
| [Frontend/src/pages/PayInvoice.jsx](Frontend/src/pages/PayInvoice.jsx) | Today: **Paystack** for public invoice pay. For Ghana MoMo: **in-app** flow (email optional if backend allows), call **public** backend endpoints that use **tenant-stored** keys (no Paystack redirect for MoMo). **Card** can remain “Pay with Paystack” if you keep cards. |
| [Frontend/src/pages/Checkout.jsx](Frontend/src/pages/Checkout.jsx) | Copy and flow currently emphasize **Paystack** for MoMo/card; split messaging: **MoMo** via your API vs **card** via Paystack, or hide MoMo on Paystack if Ghana uses direct MoMo only. |
| [Frontend/src/services/mobileMoneyService.js](Frontend/src/services/mobileMoneyService.js) | Extend **`detectProviderLocal`** (or Ghana-only rules) for **Vodafone** number ranges so POS auto-select matches backend. |
| Banners / gating | [Frontend/src/components/PaymentCollectionRequiredBanner.jsx](Frontend/src/components/PaymentCollectionRequiredBanner.jsx) (if used): “configured” should mean **tenant MoMo API connected** (or fallback phone), not only Paystack subaccount. |

**Net:** Customer-facing MoMo screens stay familiar (phone + provider + wait for approval). The **largest** frontend addition is **Settings** for secure credential onboarding; POS and public pay pages mostly **switch endpoints** and **provider list**, and **decouple MoMo from Paystack** where you today use `paystackMobileMoneyPay` / `initialize-paystack` for MoMo.

## Risks / compliance

- You are **handling third-party API secrets**; treat as **sensitive credentials** (encryption, audit log of “last updated”, no logging of secrets).  
- Terms of use: tenants warrant they own the MoMo Business accounts and keys.

## Summary opinion

Focusing on **Ghana** and **three operators** with **tenant-owned MoMo merchant APIs** is a coherent way to get **instant visibility on the tenant’s side**. The main work is **tenant-scoped credentials**, **Vodafone Cash**, **webhook routing**, and **confirming AirtelTigo Ghana’s API** against what you already have for Airtel.
