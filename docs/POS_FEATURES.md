# POS (Point of Sale) – Features Summary

This doc describes the POS as implemented in the **Frontend** (web app) and **Backend**. Use it to align marketing copy and product descriptions.

**Full app feature list:** For a complete list of all African Business Suite features (POS, invoices, jobs, reports, settings, etc.) and how they work for marketing, see [APP_FEATURES_MARKETING.md](./APP_FEATURES_MARKETING.md).

## What the POS is

- **Digital POS** – A web app that runs in the browser on **phone, tablet, or laptop**. No dedicated hardware (no physical “POS machine” required).
- **Responsive** – Layout adapts to screen size (mobile breakpoint 768px, tablet 1024px, desktop 1280px). On mobile: product list + fixed bottom cart bar + full-screen Scan Mode. On desktop: product grid + side cart.
- **Shop business type only** – POS is shown only when the tenant’s business type is a shop (e.g. retail). Studios/pharmacies use quotes/jobs/invoices; they don’t get the POS UI.
- **Payment collection required** – User must configure “payment collection” (e.g. Paystack) in Settings before POS is usable; otherwise a setup prompt is shown.

---

## Core flow

1. **Products** – Search (debounced) or browse; click product to add to cart. Optional: barcode/QR scan (camera or external scanner) to add by barcode. Products can be cached for **offline** use.
2. **Cart** – Edit quantity, per-item discount, cart-level discount. Optional: attach **customer** (search existing, walk-in, or quick-add by phone/name).
3. **Checkout** – Opens payment modal. Choose payment method → confirm. Sale is created (or queued offline).
4. **After sale** – Receipt modal: send via SMS, WhatsApp, email, or print (depending on tenant config and integrations). Auto-invoice is created for completed sales in the backend.

---

## Payments (Backend + Frontend)

- **Cash** – Amount tendered, change calculated. Quick-amount buttons suggest common denominations (e.g. round up to 200, 500).
- **Card** – Recorded as card payment; actual card processing is via Paystack (e.g. payment link), not in-POS card swipe.
- **Mobile money** – MTN MoMo, AirtelTigo Cash, Telecel Cash. When Paystack is configured and online: initiate MoMo from POS, poll until payment completes. When offline or Paystack not configured: “manual” MoMo (record payment, customer pays on their phone separately).
- **Credit** – Sale recorded as credit; invoice can be sent; balance tracked.
- **Bank transfer / Other** – Supported in backend enum; can be selected where UI exposes it.

Backend model: `paymentMethod` enum: `cash`, `card`, `mobile_money`, `bank_transfer`, `credit`, `other`.

---

## Receipts

- **Channels** – SMS, WhatsApp, Email, Print. Availability depends on tenant integrations (SMS gateway, WhatsApp, email, etc.).
- **Config** – POS config (from settings): `receipt.mode` (e.g. ask vs auto_send), `receipt.channels`. After sale, user can choose channel(s) in receipt modal; if auto_send and an integrated channel is available, receipt can be sent without opening modal.
- **Backend** – `POST /api/sales/:id/send-receipt` with `{ channels, phone?, email? }`. Builds receipt message and sends via SMS/WhatsApp/email services.

---

## Offline

- **Product cache** – Products synced to IndexedDB (posDb). When offline, search and barcode lookup use cache.
- **Customer cache** – Customers can be cached for offline lookup.
- **Pending sales queue** – Completed sales when offline are stored locally and synced when back online (`/sales/sync` batch). UI shows “Sale saved offline. Will sync when connected.”
- **Connection status** – Header shows online/offline and pending sync count.

---

## Scan Mode (mobile-first)

- **Full-screen flow** – Open camera → scan multiple items (barcode or product QR) → “Done” → review cart, add customer (optional) → payment (cash / MoMo / card) → success. Optional auto-send receipt via SMS if phone provided.
- **Use case** – Quick checkout on phone as scanner (e.g. small shop with one device). Same sale creation and receipt options as main POS; payment methods aligned with main POS (cash, mobile_money, card).

---

## Restaurant mode (optional)

- Tenant metadata `shopType === 'restaurant'` enables: “Send to kitchen” option, order status (e.g. received, preparing, ready). Sale creation and receipts otherwise same as standard POS.

---

## What to avoid in marketing

- **“Large buttons”** – The UI is responsive and touchable, but there is no specific “large button” product claim. Prefer “works on phone, tablet, and laptop” or “responsive layout.”
- **“Touch-friendly”** – Can be vague. Prefer “digital POS on any device” or “use your phone or tablet as your POS.”

## Suggested marketing wording (short)

- “Digital POS that runs on your phone, tablet, or laptop. Quick product search, barcode and QR scanning, and instant checkout—no extra hardware required.”
- “Sell with your phone or tablet: product search, barcode scan, offline support, and mobile money payments.”

Use the above to keep feature pages, app store copy, and help docs consistent with the app.
