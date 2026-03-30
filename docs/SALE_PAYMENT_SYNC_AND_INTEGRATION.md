# Sale record payment – sync and integration (no breakages)

This doc maps how **recording payment on a sale** (including the new `POST /sales/:id/payment` part-payment flow) ties into the app, reports, accounting, and cache so we don’t introduce breakages.

---

## 1. Data flow summary

When we add **record payment** (with amount) for sales:

- **Backend** updates `sale.amountPaid` and, when paid in full, `sale.status = 'completed'`.
- **Downstream** that touch sales:
  - **Dashboard** (revenue)
  - **Reports** (sales report, revenue by channel)
  - **Invoices** (auto-created from completed sale; amountPaid/balance must match sale)
  - **Accounting** (sale revenue/COGS journals when sale is completed)
  - **Mobile app** (sales list and detail)
  - **WebSocket** (optional: notify “sale updated”)
  - **Cache** (sale list, and optionally dashboard/reports)

---

## 2. Dashboard

| What | How it uses sales | Impact of record payment |
|------|-------------------|---------------------------|
| **Revenue (shop/pharmacy)** | `GET /api/dashboard/overview` → SQL: `SUM(sales.total) WHERE status = 'completed'` and date filter. | Revenue only counts **completed** sales. When we record payment and set `status = 'completed'`, that sale is included on next dashboard load. No change to query logic. |
| **Recent sales** | Same overview returns `shopData.recentSales` (last 5 sales, any status). | List shows updated sale (e.g. status, amountPaid) after refetch. |
| **Caching** | Dashboard controller uses in-memory `dashboardCache` (key: `tenantId:startDate:endDate:filterType`). Frontend uses React Query (e.g. 2 min staleTime). | After recording payment, dashboard can show stale revenue until cache expires or user refetches. **Recommendation:** when implementing `POST /sales/:id/payment` (and when `updateSale` sets status to completed), call `invalidateTenantCache(tenantId)` from dashboard controller so dashboard overview refetches with new numbers. |

**No breaking change** to dashboard logic; optional improvement is cache invalidation.

---

## 3. Reports

| Report / use | How it uses sales | Impact of record payment |
|--------------|-------------------|---------------------------|
| **Sales report** (`GET /api/reports/sales`) | Shop/pharmacy: `Sale.sum('total', { where: { status: 'completed', ...dateFilter } })`, `Sale.count`, and “by payment method” from same `status = 'completed'` filter. | Only **completed** sales and their **total** are used. When we set `status = 'completed'` (after full payment), the sale is included. No change to report logic. |
| **Variance detection** | Uses `sale.total` and `sale.status` (e.g. cancelled/refunded). | No dependency on `amountPaid`; no breakage. |
| **Revenue by channel** | Same `Sale` query with `status = 'completed'`, grouped by `paymentMethod`. | Uses `sale.total` and `sale.paymentMethod`. If we update `paymentMethod` when recording the final payment, reports stay consistent. |

**No breaking change** to reports; they rely on `status = 'completed'` and `total`, not on partial `amountPaid`.

---

## 4. Invoices (sale → invoice)

| Flow | Behaviour | Impact of record payment |
|------|------------|---------------------------|
| **Auto-create invoice** | When a sale becomes `status = 'completed'`, `autoCreateInvoiceFromSale(saleId, tenantId)` runs. It currently sets invoice `amountPaid` / `balance` from **payment method** (e.g. paid if not credit), not from `sale.amountPaid`. | **Risk:** For a sale that was pending and then completed via “record payment”, if we only set `sale.amountPaid = total` and `sale.status = 'completed'`, the auto-invoice still uses “isPaidImmediately” from `paymentMethod`. So invoice could be created as paid (correct). **Recommendation:** In `autoCreateInvoiceFromSale`, set invoice `amountPaid = sale.amountPaid`, `balance = sale.total - sale.amountPaid`, and `status = balance <= 0 ? 'paid' : 'partial'` so part-paid sales that are later completed stay consistent. |
| **Invoice already exists** | If an invoice was already created for the sale (e.g. manual “Generate invoice”), recording payment on the sale does not today update that invoice. | For the new **record payment** flow we only update the sale. If the product requirement is “when sale is completed, invoice should reflect it”, that’s already handled by auto-create. If we ever support “record payment on sale” when an invoice already exists, we’d add a sync step (e.g. update invoice `amountPaid` / `balance` from sale). Out of scope for initial part-payment feature. |

**Action:** Align `autoCreateInvoiceFromSale` with `sale.amountPaid` / `sale.total` so invoices reflect part payments and completion correctly.

---

## 5. Accounting (journals)

| What | When it runs | Impact of record payment |
|------|----------------|---------------------------|
| **Sale revenue journal** | `createSaleRevenueJournal(tenantId, saleId)` uses `sale.total` (and subtotal, discount, tax). Called from **createSale** and **batchSyncSales** when sale is completed. **Not** called from **updateSale** when status is changed to completed. | **Gap:** Today, when we set a sale to completed via **updateSale** (e.g. “Record payment” → status completed), revenue/COGS journals are **not** created. So accounting can be missing entries for those sales. |
| **Sale COGS journal** | Same as above; `createSaleCogsJournal` is only called on create/batchSync. | Same gap as revenue. |

**Action for new `POST /sales/:id/payment`:** When this endpoint sets `status = 'completed'` (because `amountPaid >= total`), after updating the sale we must:

1. Run `autoCreateInvoiceFromSale(sale.id, tenantId)` if no invoice exists.
2. Run `createSaleRevenueJournal(tenantId, sale.id, req.user?.id)`.
3. Run `createSaleCogsJournal(tenantId, sale.id, req.user?.id)`.

**Recommendation:** Also add the same journal (and optionally invoice) logic to **updateSale** when `updateData.status === 'completed'`, so existing “Record payment” (status-only) flow is correct and consistent with the new payment endpoint.

---

## 6. Mobile app

| What | How | Impact of record payment |
|------|-----|---------------------------|
| **Sales list** | `saleService.getSales(params)` → `GET /api/sales`. React Query key: `['sales', activeTenantId, statusFilter]`. | Backend returns updated `amountPaid` and `status` after record payment. On next refetch or list refresh, app sees the updated sale. No API change. |
| **Sale detail** | `saleService.getSaleById(sale.id)` → `GET /api/sales/:id`. | Same; detail shows current `amountPaid` and status. |
| **Offline** | Sales created offline are synced via `POST /api/sales/sync`. Recording payment is done on the server (web or app when online). | No conflict; payment is recorded on the same sale entity. |

**No breaking change** for the app; it only consumes `GET /sales` and `GET /sales/:id`. Optionally the app can later add a “Record payment” action that calls `POST /sales/:id/payment`.

---

## 7. WebSocket / real-time

| Event | When | Impact of record payment |
|--------|------|---------------------------|
| **sale:created** | Emitted in createSale, MoMo success, webhook. | Not needed for “record payment” (sale already exists). |
| **sale:updated** | `emitSaleStatusChange(tenantId, sale, oldStatus)` exists but is **not** called from **updateSale**. | If we want real-time UI updates when payment is recorded, we should call `emitSaleStatusChange` when status changes to completed (both in **updateSale** and in the new **record payment** handler). |

**Recommendation:** When `POST /sales/:id/payment` (or updateSale) sets status to completed, call `emitSaleStatusChange(req.tenantId, updatedSale, 'pending')` so subscribed UIs (e.g. dashboard, sales list) can refresh or show a toast.

---

## 8. Cache invalidation

| Cache | When to invalidate | Current behaviour | Action |
|-------|--------------------|--------------------|--------|
| **Sale list** | After any sale create/update/delete. | `invalidateSaleListCache(tenantId)` is called in createSale, updateSale, cancelSale, deleteSale, MoMo/webhook. | In the new `POST /sales/:id/payment` handler, call `invalidateSaleListCache(req.tenantId)` after updating the sale. |
| **Dashboard** | After changes that affect revenue (e.g. sale completed). | Not invalidated on sale update. | Optionally call `invalidateTenantCache(tenantId)` (dashboard controller) or use middleware `invalidateAfterMutation(tenantId)` so dashboard overview refetches. |
| **Reports** | After changes that affect report numbers. | `invalidateReportCache` exists. | Optional: call from record-payment handler so report caches refresh. |

**Must-have:** Invalidate sale list cache in the new record-payment endpoint. **Nice-to-have:** Invalidate dashboard (and optionally reports) so numbers update without waiting for TTL.

---

## 9. Payment model and double-counting

| Concern | Detail |
|---------|--------|
| **Payment record** | New flow can create a `Payment` row (type `income`, customerId from sale, amount, paymentMethod, notes e.g. “Payment for sale SALE-xxx”) for audit. Payment model has no `saleId`; linking is via notes or a future `saleId` column. |
| **Double-counting** | Revenue is counted from **Sale** (dashboard/reports use `Sale.total` and `status = 'completed'`), not from Payment rows. So creating a Payment for a sale does not double-count revenue. |
| **Invoice payment** | When an invoice is linked to a sale and is paid (via invoice payment or public pay), the backend can set the sale to completed. That path does not go through the new sale record-payment endpoint; no conflict. |

---

## 10. Implementation checklist (no breakages)

When implementing **record part payment** for sales (`POST /api/sales/:id/payment`):

1. **Backend – record payment endpoint**
   - Update `sale.amountPaid`, optionally `paymentMethod` for the payment.
   - If `amountPaid >= total`, set `status = 'completed'`.
   - When setting `status = 'completed'`:
     - Run `autoCreateInvoiceFromSale(sale.id, tenantId)` if `!sale.invoiceId`.
     - Run `createSaleRevenueJournal(tenantId, sale.id, req.user?.id)`.
     - Run `createSaleCogsJournal(tenantId, sale.id, req.user?.id)`.
   - Create `SaleActivity` (e.g. type `payment`).
   - Optionally create `Payment` record (income, customerId, amount, method, notes).
   - Call `invalidateSaleListCache(req.tenantId)`.
   - Optionally call `emitSaleStatusChange(req.tenantId, updatedSale, 'pending')` and dashboard/report cache invalidation.

2. **Backend – auto-create invoice**
   - In `autoCreateInvoiceFromSale`, set invoice `amountPaid` and `balance` from `sale.amountPaid` and `sale.total` (and status `paid` / `partial`), not only from payment method, so part-paid sales and “record payment” completions stay in sync.

3. **Backend – updateSale (optional but recommended)**
   - When `updateData.status === 'completed'`, after commit run the same post-completion steps as above: auto-create invoice if missing, create sale revenue journal, create sale COGS journal, so “Record payment” (status-only) and “Record payment” (with amount) are consistent.

4. **Frontend – Sales page**
   - “Record payment” opens a modal (amount, method, optional reference); submit to `POST /sales/:id/payment`. Refresh list and detail on success.

5. **Mobile app**
   - No change required for sync; optional later: add “Record payment” that calls `POST /sales/:id/payment` and refetches sales.

6. **Reports / dashboard**
   - No query or formula changes; ensure cache invalidation so new revenue appears after recording payment.

---

## 11. Summary

- **Dashboard and reports** use `Sale.total` and `status = 'completed'` only; recording payment that sets status to completed keeps everything consistent. Invalidate caches so numbers update promptly.
- **Invoices** stay correct if `autoCreateInvoiceFromSale` uses `sale.amountPaid` / `sale.total` for amountPaid and balance.
- **Accounting** must run sale revenue and COGS journals when a sale is completed via the new record-payment endpoint (and ideally when completed via updateSale).
- **App** and **sync** only need the existing GET APIs; no breaking changes. Optional: WebSocket and dashboard/report cache invalidation for better UX.

Following this checklist keeps the app, reports, and accounting in sync and avoids breakages when adding record (part) payment for sales.
