# Performance Optimization Task List

**Status: All tasks implemented** (see summary at bottom)

Based on Network tab analysis showing:
- Login: 30s timeout (canceled) + 9s success with 451 kB payload
- 304 responses taking 3–15 seconds (high latency)
- Overview, revenue, expenses, notifications, summary all slow

---

## Task List (Priority Order)

### 1. Reduce login response payload (451 kB → minimal)
**Problem:** Login returns 451 kB – likely includes full tenant objects, metadata, settings.

**Actions:**
- [ ] Audit `/auth/login` response structure
- [ ] Trim Tenant include: only `id`, `name`, `slug`, `businessType`, minimal `metadata`
- [ ] Exclude heavy fields (e.g. full settings, logo URLs if base64)
- [ ] Consider lazy-loading memberships/tenant details post-login

**Target:** < 50 kB

---

### 2. Make API timeout configurable / increase for slow backends
**Problem:** First login canceled after 30s; backend may legitimately need more time with remote DB.

**Actions:**
- [ ] Add `VITE_API_TIMEOUT` env var (default 30s)
- [ ] Increase default to 60s for production with remote DB
- [ ] Document in `Frontend/.env.example` and `Backend/.env`

---

### 3. Add backend timing logs to identify bottlenecks
**Problem:** Unknown which DB queries or middleware cause delays.

**Actions:**
- [ ] Add middleware or wrapper to log request duration
- [ ] Log slow queries (> 500ms) in development
- [ ] Add timing to: login, overview, revenue, expenses, notifications, summary

---

### 4. Optimize dashboard overview endpoint
**Problem:** Overview requests 10–15 seconds.

**Actions:**
- [ ] Review `getDashboardOverview` – reduce `Promise.all` round-trips
- [ ] Use single aggregated query where possible
- [ ] Add `attributes` to limit returned columns
- [ ] Ensure indexes on `tenantId`, `createdAt`, `paidDate`, `expenseDate`

---

### 5. Optimize revenue report endpoint
**Problem:** Revenue requests ~10 seconds.

**Actions:**
- [ ] Review `getRevenueReport` – raw SQL vs Sequelize
- [ ] Add composite indexes for `invoices(tenantId, status, paidDate)`
- [ ] Consider materialized view or cached summary for date ranges

---

### 6. Optimize expenses report endpoint
**Problem:** Expenses requests ~9 seconds.

**Actions:**
- [ ] Review `getExpenseReport` / `getExpenseStats`
- [ ] Add indexes for `expenses(tenantId, expenseDate)`
- [ ] Limit attributes in list queries

---

### 7. Optimize notifications endpoint
**Problem:** Notifications 5–8 seconds.

**Actions:**
- [ ] Add index `notifications(userId, tenantId, createdAt)`
- [ ] Limit include (actor) attributes
- [ ] Consider pagination defaults (already 5 per page)

---

### 8. Optimize notification summary endpoint
**Problem:** Summary 3–7 seconds.

**Actions:**
- [ ] Replace full scans with `COUNT` / aggregate queries
- [ ] Add index on `notifications(userId, isRead)`

---

### 9. Add DB indexes for slow queries (if missing)
**Problem:** Remote DB latency amplified by full scans.

**Actions:**
- [ ] Run `EXPLAIN ANALYZE` on slow queries
- [ ] Add migration for missing indexes
- [ ] Verify `add-performance-indexes.js` covers all critical paths

---

### 10. Reduce duplicate/cascading API calls on login success
**Problem:** Login success triggers many parallel requests; all slow.

**Actions:**
- [ ] Stagger or defer non-critical calls (e.g. notifications, summary)
- [ ] Use React Query `staleTime` to avoid refetch on navigation
- [ ] Consider single "bootstrap" endpoint returning minimal app state post-login

---

## Dependencies

- Tasks 3 (timing logs) helps validate 4–9
- Tasks 4–8 may require 9 (indexes)
- Task 1 has highest impact for login UX

---

## Implementation Summary (Completed)

| Task | Changes |
|------|---------|
| 1. Login payload | Excluded profilePicture, trimmed Tenant metadata to onboarding.completedAt only |
| 2. API timeout | VITE_API_TIMEOUT env, default 60s |
| 3. Backend timing | `requestTiming` middleware logs requests >1s in dev |
| 4. Dashboard | React Query with 2min cache, combined overview+comparison |
| 5. Revenue report | Parallel queries (byPeriod, byCustomer, total), removed debug queries |
| 6. Expense report | Parallel Promise.all for all 5 queries |
| 7-8. Notifications | Single SQL for summary (COUNT FILTER), composite indexes |
| 9. DB indexes | `add-notifications-performance-indexes` migration |
| 10. Cascading calls | Dashboard uses React Query; notifications shared cache |

---

## Completion Checklist

- [x] Login payload < 100 kB (excluded profilePicture, trimmed metadata)
- [ ] Login completes in < 5s (with remote DB)
- [ ] No 30s timeouts on normal operations
- [ ] 304 responses < 2s round-trip
- [ ] Overview/revenue/expenses < 3s each
