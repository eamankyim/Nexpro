# POS, QR, Barcode & Sales – Master Checklist

Use this checklist to verify current behaviour, roll out African-market improvements, and implement barcode vs QR flows.

---

## 1. Current flow verification (what should work today)

Use this to confirm the system behaves as designed.

### Product & catalog

- [ ] Product has a **barcode** field; can be set when creating/editing product (for wholesale/branded items).
- [ ] Product **QR** can be generated from Products page (Generate QR) for items without barcode.
- [ ] QR content is JSON with `name`, `sku`, `barcode`, `sellingPrice`, etc. (see `Frontend/src/utils/productQR.js`).
- [ ] **Backend** `GET /products/barcode/:barcode` returns product by barcode (used for barcode-at-POS later).

### Main POS (desktop/tablet)

- [ ] Add items by **search** (name/SKU).
- [ ] Add items by **scanning product QR** (one at a time via search-area scanner).
- [ ] **Customer**: Select existing (search) or Walk-in.
- [ ] **Checkout** → Payment (Cash, MoMo, Card, Credit).
- [ ] **Receipt modal**: Print, SMS (default), WhatsApp, Email; for walk-in, staff can type phone/email.
- [ ] **Offline**: Sale queues and syncs when back online; receipt can be sent when back online.

### Scan Mode (mobile / phone as scanner)

- [ ] **Scan** step: Camera scans **QR only**; multiple items; Tap **Done**.
- [ ] **Review** step: Cart + **Customer name & phone** (or search existing).
- [ ] **Payment** step: Cash / MoMo / Card; confirm.
- [ ] On confirm: **findOrCreate** customer by phone; sale created; **auto SMS receipt** if phone given.
- [ ] **Success** step: Sale complete; receipt sent (if phone provided).

### Customer & receipt

- [ ] **findOrCreate** `POST /customers/find-or-create` (phone required, name optional) – used in Scan Mode.
- [ ] **Send receipt** uses `phone` or `email` from request body or sale.customer.
- [ ] **SMS** receipt: tenant SMS settings; message includes sale #, date, items, total (GHS).
- [ ] **WhatsApp**: Backend currently returns “not yet implemented”.

---

## 2. Barcode vs QR – implementation checklist

**Rule:** Products that already have a barcode (e.g. Coca Cola) → link product to that barcode in the system; at POS, scan the **barcode** (no QR). Products without a barcode → generate **QR**, print, attach; at POS, scan **QR**.

### Product catalog

- [ ] Product form clearly supports **Barcode** (for wholesale/branded items).
- [ ] Products page / docs: short note that “Barcode = use existing product barcode; QR = for items with no barcode”.
- [ ] (Optional) Bulk import/edit of barcodes for existing products.

### POS – barcode scanning

- [ ] **Main POS** (product search area): Add “Scan barcode” mode or option that:
  - Uses camera/scanner to read **barcode** (EAN-13, UPC, etc.), not only QR.
  - On scan: call `GET /products/barcode/:barcode` (or equivalent), then add product to cart if found.
- [ ] **Scan Mode**: Add barcode support alongside QR:
  - Either same scanner with both barcode + QR formats, or a “Barcode” vs “QR” toggle.
  - When barcode is scanned: resolve via `getProductByBarcode`, add to cart.
  - When QR is scanned: keep current flow (parse JSON → resolve by barcode/SKU → add to cart).
- [ ] **Error handling**: “Product not found for this barcode” with option to open product search or add product (if product-add from POS is allowed).

### POS – QR (unchanged for no-barcode products)

- [ ] QR scan flow still works for products that use **generated QR** (no barcode).
- [ ] Generate QR from Products page still includes barcode in payload if product has one (for consistency).

### Documentation

- [x] **Usage note (in-app and docs):** “Use **barcode** for products that already have a barcode (e.g. from wholesale); at POS, scan the product barcode. Use **QR** for products without a barcode: generate QR from the Products page, print and attach; at POS, scan the QR.”

---

## 3. African market – improvement checklist

### Customer capture

- [ ] **Main POS – Quick add customer**: Add “Quick add customer” (phone + optional name) before or at checkout; call `findOrCreate`, link sale to customer, pre-fill receipt modal.
- [ ] **Main POS – Prompt for walk-in**: When customer is walk-in, optional step before payment: “Customer phone for receipt?” (and optionally name); then findOrCreate and attach to sale or pass to receipt modal.
- [ ] **Phone validation**: Accept common formats (e.g. 0XXXXXXXXX, +233 for Ghana); normalize before findOrCreate and before sending SMS/WhatsApp.

### Receipt delivery

- [ ] **WhatsApp receipt**: Implement WhatsApp sending (e.g. WhatsApp Business API or approved provider); tenant settings; use same receipt message as SMS where appropriate.
- [ ] **Receipt message**: Include shop/tenant name; keep SMS short; optional “Reply HELP for support” if configured.
- [ ] **Offline receipt**: UI clearly shows “Receipt will be sent when back online” when offline.

### Product not in catalog

- [ ] **Option A – Add from QR**: When “Product not found for this QR code”, offer “Add product to catalog” using parsed QR data (name, sku, barcode, price, etc.) then add to cart.
- [ ] **Option B – Unknown item**: Allow “Unknown item” line (name + price + qty) without a product record for one-off sales.
- [ ] (Pick one or both based on product strategy.)

### Other

- [ ] **Mobile money**: Confirm MTN/Airtel payment flow and reference number capture work in production.
- [ ] **Currency/locale**: GHS (and any other locale) correct in receipt and UI.
- [ ] **Multi-country**: If supporting more countries, phone validation and normalization per country.

---

## 4. Sales, POS & Products – use cases (reference)

From the Sales/POS/Products use-cases plan – items that were implemented or documented.

### Backend auth & data

- [x] Backend `authorize()` uses effective role (tenant owner/admin → admin; else User.role).
- [x] Staff “own” filtering: sales (soldBy), quotes (createdBy), invoices (from their sales/jobs).
- [x] POS and Products pages guarded by business type (shop only); Sales removed from sidebar for pharmacy.
- [x] Products Export button only for admin/manager.

### Optional follow-ups

- [ ] Route or feature guard by business type on backend for `/pos` and `/products` (e.g. 403 for non-shop tenant).
- [ ] Products UI: hide or disable Bulk delete for staff (if bulk-delete UI is added).

---

## 5. Quick reference – where things live

| Area              | Frontend / Backend |
|-------------------|--------------------|
| Product barcode   | Product model + form; `GET /products/barcode/:barcode` (Backend) |
| Product QR       | `Frontend/src/utils/productQR.js`; Generate QR on Products page |
| POS main         | `Frontend/src/pages/POS.jsx`; product search + cart + payment + receipt |
| POS Scan Mode     | `Frontend/src/components/pos/POSScanMode.jsx` (barcode + QR) |
| POS product search + scan | `Frontend/src/components/pos/POSProductSearch.jsx` (barcode + QR scanner) |
| findOrCreate customer | `POST /customers/find-or-create` (Backend); `customerService.findOrCreate` (Frontend) |
| Send receipt     | `POST /sales/:id/send-receipt` (Backend); SMS/Email implemented; WhatsApp stubbed |
| Resolve product from QR | `parseProductQRPayload` + `resolveProductFromQRPayload` (barcode then SKU lookup) |

---

*Last updated: Jan 2026. Adjust checkboxes as you complete or skip items.*
