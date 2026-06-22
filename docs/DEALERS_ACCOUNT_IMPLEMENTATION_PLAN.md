# Dealers Account — Internal Implementation Plan

**Internal · ABS · Pilot: JOSFAA ENT · Stack:** Node/Express, Sequelize, React (shadcn), PostgreSQL

Product requirements: `docs/DEALERS_ACCOUNT_PROJECT.md`

---

## Locked discovery decisions (JOSFAA ENT)

These decisions are **fixed for v1**. Do not re-open without client sign-off.

### 1. Product catalogue is per branch

JOSFAA ENT already maintains products per branch/shop (`Product.shopId`), not tenant-wide.

**Implementation implications:**
- `DealerProductPrice` must include `shopId` (FK → `shops.id`) and reference branch-scoped `productId` / `productVariantId`.
- Unique constraint: `(tenantId, shopId, dealerId, productId, productVariantId)` (and tier variant).
- `dealerPricingService.resolvePrice({ dealerId, productId, variantId, shopId })` — dealer-specific → tier → retail `sellingPrice` for **that shop's product row**.
- All dealer pricing APIs require `shopId` (query param or `x-shop-id` via `shopContext`).
- POS dealer mode uses active branch from `Frontend/src/context/ShopContext.jsx` (`activeShopId`); product search, dealer list, and price resolution scoped to that shop.
- **Dealers are branch-scoped** (`Dealer.shopId`); each branch has its own dealer list and balance. Ledger entries keep `shopId` for attribution. Price tiers remain tenant-wide.

### 2. Opening balance only at go-live

No import of historical transaction history from notebooks. Pilot setup = dealer list + opening balances only.

**Implementation implications:**
- Seed script (`Backend/scripts/seed-josfaa-dealers.js` or admin one-off): create `Dealer` rows + one `DealerLedgerEntry` each (`entryType: opening_balance`, direction `debit`, `entryDate` = go-live).
- **No** bulk historical ledger import endpoint in v1; defer transaction-history migration to v2 if needed.
- Statements show activity from go-live forward; opening balance appears as first line.

### 3. No accounting entries in v1

Dealer ledger + statements + receivables reporting only. No AR journal posting / accounting module integration.

**Implementation implications:**
- **Do not implement** `dealerAccountingService` or posting to `accountingAccountCodes.accountsReceivable` (`Backend/config/accountingAccountCodes.js`).
- **Skip** `autoCreateInvoiceFromSale` for dealer-account charges (`saleChannel: 'dealer'` or `dealerId` set) — ledger is operational source of truth.
- **Skip** `ensureRequiredCreditSaleInvoice` / `invoiceAccountingService` paths for dealer sales.
- Dealer payments write to `DealerLedgerEntry` only (optional `Payment.dealerId` for audit; no journal).
- **v2 note:** optional AR sync from ledger totals if JOSFAA adopts full accounting module.

---

## Current-state summary

| Area | Exists today | Gap |
|------|--------------|-----|
| Customers | `Customer.js` — invoice-derived `balance` | Retail only; no true ledger |
| Sales | `Sale` + `SaleItem`; `customerId`; `credit` payment | No `dealerId`; retail pricing only |
| POS | `POS.jsx` — products first, optional customer | No dealer-first flow or split settlement |
| Products | `Product.shopId` per branch | No dealer-specific prices |
| Branches | `shopContext` middleware, `ShopContext.jsx` | Reuse for catalog/pricing scope |
| Ledger pattern | `MarketplaceLedgerEntry` | Model for `DealerLedgerEntry` |
| Accounting | `autoCreateInvoiceFromSale`, `invoiceAccountingService` | **Out of v1 for dealers** |

---

## Architecture decisions

| Decision | Choice |
|----------|--------|
| Dealer vs Customer | **Separate `Dealer` model** — keep retail CRM/POS unchanged |
| Ledger | **`DealerLedgerEntry`** append-only + cached `Dealer.balance` |
| Pricing | **`DealerProductPrice`** (+ optional `DealerPriceTier`), **scoped by `shopId`** |
| Sale linkage | **`Sale.dealerId`**, `saleChannel: 'retail' \| 'dealer'` |
| Dealer scope | **Per-branch** (`Dealer.shopId`); ledger entries carry `shopId` for attribution |
| Mobile | **Out of v1** — web POS only |

### Ledger entry types

`opening_balance` · `sale_charge` · `payment` · `adjustment` · `reversal` (optional v1)

### Schema (key tables)

**`dealers`** — `tenantId`, **`shopId`**, `businessName`, `contactName`, `phone`, `email`, `creditTerms`, `creditLimit`, `balance`, `priceTierId`, `notes`, `isActive`, `metadata` — unique `(tenantId, shopId, businessName)`

**`dealer_product_prices`** — `tenantId`, **`shopId`**, `dealerId` (nullable), `priceTierId`, `productId`, `productVariantId`, `unitPrice`, `isActive`

**`dealer_ledger_entries`** — `tenantId`, `dealerId`, `shopId`, `entryType`, `direction`, `amount`, `balanceAfter`, `saleId`, `paymentId`, `description`, `entryDate`, `createdBy`, `metadata`

**`sales` (alter)** — `dealerId`, `saleChannel`

Migration pattern: `Backend/migrations/create-marketplace-trade-assurance.js`; register in `Backend/migrations/migrate.js`; models in `Backend/models/index.js`.

---

## Backend API

Mount: `Backend/routes/dealerRoutes.js` → `/api/dealers`

Middleware: `protect` → `tenantContext` → `shopContext` (pricing + ledger `shopId` attribution)

| Area | Routes |
|------|--------|
| CRUD | `GET/POST /dealers`, `GET/PUT/PATCH /dealers/:id` |
| Ledger | `GET /dealers/:id/ledger`, `POST .../payments`, `POST .../ledger/adjustment` (manager+) |
| Pricing | `GET/PUT /dealers/:id/prices?shopId=`, tier CRUD |
| Statements | `GET /dealers/:id/statement`, PDF/print |
| Reports | `GET /dealers/report/outstanding` |
| POS | `GET /dealers/pos-search`, extend `POST /api/sales` (`saleController.js`) |

**Services:** `dealerBalanceService.js`, `dealerPricingService.js`, `dealerLedgerService.js`, `dealerStatementService.js`

**Feature gate:** `dealersAccount` in `Backend/config/features.js` + `tenantEntitlements.js` override for JOSFAA.

**Credit check:** `projectedBalance = balance + chargeToAccount`; warn if over limit; manager override via `creditOverride` + `authorize('admin','manager')`.

---

## Frontend (web)

| Route | File |
|-------|------|
| `/dealers` | `Frontend/src/pages/Dealers.jsx` |
| `/dealers/:id` | `Frontend/src/pages/DealerDetail.jsx` |
| `/dealers/:id/prices` | `Frontend/src/pages/DealerPricing.jsx` (branch selector + active shop default) |

Services: `Frontend/src/services/dealerService.js` · Statement: `PrintableDealerStatement.jsx` (pattern: `PrintableInvoice.jsx`)

Sidebar: `Frontend/src/constants/sidebarMenus.js` · Routes: `Frontend/src/App.jsx` · `FeatureRoute` for `dealersAccount`

---

## POS integration

**Files:** `Frontend/src/pages/POS.jsx`, `Frontend/src/components/pos/POSPaymentModal.jsx`, `Backend/controllers/saleController.js`

1. Mode toggle: **Retail** (unchanged) | **Sell to dealer**
2. **Dealer-first:** select dealer before cart; show balance + available credit
3. Prices from `dealerPricingService` using **`activeShopId`** (not `getCatalogUnitPrice` alone)
4. Settlement: charge to account · pay now · split (`chargeToAccount` + `amountPaid`)
5. Backend: create `Sale` + stock decrement; ledger `sale_charge` for account portion; **no** `autoCreateInvoiceFromSale`
6. Entry: `Sales.jsx` → `?openPOS=1&mode=dealer`

---

## Phased build order

| Phase | Scope | Deliverable |
|-------|--------|-------------|
| **1 — Foundation** | Migrations, models, `dealersAccount` flag, dealer CRUD, opening balance on create | Dealer list + balances |
| **2 — Ledger & payments** | `DealerLedgerEntry`, payments, manager adjustments | Payments reduce balance; audit trail |
| **3 — Branch-scoped pricing** | `DealerProductPrice` + `shopId`, pricing API, `DealerPricing.jsx` | Wholesale prices per branch catalog |
| **4 — POS dealer mode** | `Sale.dealerId`, dealer sale path, credit check, POS UI | End-to-end web POS dealer sale |
| **5 — Statements & reporting** | Statement PDF, outstanding report, dashboard receivables | Statements + receivables report |
| **6 — Pilot hardening** | JOSFAA seed (dealers + opening balances + branch prices), UAT, indexes | Production pilot |

---

## Pilot setup (JOSFAA ENT)

1. Enable `metadata.entitlements.featureOverrides.dealersAccount = true` on tenant
2. Seed script: dealer list + **opening balance entries only** + per-branch price rows matched by SKU/barcode to `Product` where `shopId` = branch
3. Validate `Shop` rows and staff `UserShop` assignments per branch
4. Train web POS dealer mode; retail POS unchanged

---

## Testing

- Unit: `dealerBalanceService`, `dealerPricingService` (shop + dealer precedence), `saleController` dealer path
- Integration: dealer sale → ledger → balance; concurrent sales same dealer
- UAT: success criteria in `DEALERS_ACCOUNT_PROJECT.md` §9; dealer sale/payment at one branch does not affect another branch's dealer balance

---

## Risks (remaining)

- **Dual balance systems** — isolate dealer ledger from `customerBalanceService` / `Invoice`
- **Branch product drift** — same SKU may differ by branch; prices must target correct `productId` per `shopId`
- **POS state** — isolate dealer mode in `usePOSDealerMode` hook; regression-test retail path

**Resolved (locked):** per-branch catalog · per-branch dealers and balances · opening balance only · no accounting v1 · split payments in v1 · credit limit = warn + manager override

---

## Key file paths

| Layer | Paths |
|-------|-------|
| Models | `Backend/models/Customer.js`, `Sale.js`, `Product.js`, `Shop.js`, `MarketplaceLedgerEntry.js` |
| Controllers | `Backend/controllers/saleController.js`, `customerController.js`, `reportController.js` |
| Middleware | `Backend/middleware/shopContext.js`, `auth.js` |
| Services | `Backend/services/customerBalanceService.js`, `invoiceAccountingService.js` (retail only) |
| Config | `Backend/config/features.js`, `accountingAccountCodes.js`, `enterpriseTiers.js` |
| Frontend POS | `Frontend/src/pages/POS.jsx`, `components/pos/POSPaymentModal.jsx`, `hooks/usePOS.js` |
| Shop context | `Frontend/src/context/ShopContext.jsx` |
| Mobile (v2+) | `mobile/app/(tabs)/cart.tsx` |
