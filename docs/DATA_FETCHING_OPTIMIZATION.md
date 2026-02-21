# Data Fetching Optimization Audit

## Summary

Audit of frontend and backend data fetching patterns. Key findings and implemented fixes below.

---

## Frontend

### ✅ What's Already Good

1. **React Query** – Used on Jobs, Dashboard, Invoices, POS, Employees, Accounting, Payroll, FootTraffic. Provides caching, `staleTime`, and deduplication.
2. **Debouncing** – Search inputs use `useDebounce` (500ms) across list pages.
3. **Backend pagination cap** – `maxPageSize: 100` limits over-fetching.
4. **Parallel fetches** – Dashboard uses `Promise.all`; Reports use `Promise.all` for 9 report types.

### ⚠️ Issues Found (Now Fixed)

| Issue | Impact | Status |
|-------|--------|--------|
| **Fetch limit 1000/10000** | Many pages request 1000+ rows; backend caps at 100. Large requests still add overhead. | ✅ Fixed |
| **Customers summary stats** | Fetches "all" customers (limit 10000) to compute counts; backend returns max 100 → incorrect stats | ✅ Fixed |
| **Client-side filtering** | Jobs apply priority/dueDate filters client-side after fetch; limits effective pagination | ✅ Fixed |
| **Manual fetch (no cache)** | Inventory, Customers, Vendors, Expenses, Products, Leads, etc. refetch on every visit | 🔄 Partial (migrate to React Query) |

### Recommended Limits by Use Case

- **List with pagination:** `limit: pagination.pageSize` (e.g. 10–50)
- **Dropdowns:** `limit: 100` (reference data)
- **Export:** dedicated export endpoint with streaming

---

## Backend

### ✅ What's Already Good

1. **Performance indexes** – `add-performance-indexes.js` adds composite indexes for jobs, invoices, expenses, customers, sales, inventory.
2. **Tenant-first queries** – Queries filter by `tenantId` early.
3. **Pagination utils** – `getPagination()` caps `limit` at 100.

### ⚠️ Potential Improvements

| Area | Suggestion | Status |
|------|------------|--------|
| **Job filters** | Support `priority` and `dueDate` in `/jobs` so pagination is correct. | ✅ Implemented |
| **List payloads** | Add `attributes` for list views to avoid returning full models. | 🔄 Recommended |
| **Cache** | Customers list uses 60s cache; consider extending for stable reference data. | 🔄 Recommended |

---

## Implemented Optimizations

### 1. GET /customers/stats (✅ Completed)
**Problem:** Customers page was fetching up to 10,000 customer records just to count active/inactive/returning customers.

**Solution:**
- Created new `/api/customers/stats` endpoint that returns counts using a single SQL query with `COUNT` and `FILTER`.
- Frontend now calls this lightweight endpoint for summary cards instead of fetching all records.
- **Impact:** Reduced data transfer from ~10,000 records to a single JSON object with counts.

### 2. Inventory Server-Side Pagination (✅ Completed)
**Problem:** Inventory page was fetching 1,000 items and doing client-side filtering/pagination.

**Solution:**
- Changed frontend to use `limit: pagination.pageSize` (default 10) for API calls.
- Backend already supports pagination; frontend now uses `response.count` for total.
- Enhanced backend `getInventorySummary` to include `inStockCount` and `outOfStockCount` for accurate stats.
- Frontend uses server-provided summary data for DashboardStatsCard instead of computing from partial local data.
- **Impact:** Reduced data transfer from 1,000 to 10 items per page.

### 3. Reduced Fetch Limits Across Pages (✅ Completed)
**Problem:** Many pages were fetching with `limit: 1000` for client-side filtering, causing unnecessary data transfer and memory usage.

**Solution:**
- **Jobs:** Changed `limit: 1000` to `limit: pagination.pageSize`. Added backend filters for `priority` and `dueDate` to support proper server-side pagination.
- **Sales:** Reduced customer fetch from `limit: 1000` to `limit: 100`.
- **Invoices:** Reduced customer fetch from `limit: 1000` to `limit: 100`, changed main fetch to `limit: pagination.pageSize`.
- **Vendors:** Changed from `limit: 1000` to `limit: pagination.pageSize`.
- **Expenses:** Changed from `limit: 1000` to `limit: pagination.pageSize`.
- **Quotes:** Changed from `limit: 1000` to `limit: pagination.pageSize`.
- **Pricing:** Changed from `limit: 1000` to `limit: pagination.pageSize`.
- **Users:** Changed from `limit: 1000` to `limit: pagination.pageSize`.
- **Products:** Reduced product fetch from `limit: 1000` to `limit: 100`.
- **Impact:** Significantly reduced data transfer on initial page loads.

### 4. Jobs Backend Filters (✅ Completed)
**Problem:** Jobs page was fetching all jobs and doing client-side filtering for `priority` and `dueDate`, making pagination inaccurate.

**Solution:**
- Added `priority` and `dueDate` query parameters to `/api/jobs` backend endpoint.
- Backend now filters by priority directly and supports dueDate filters: `overdue`, `today`, `this_week`.
- Frontend now passes these filters to backend and uses server-side pagination.
- Removed client-side filtering and pagination logic from frontend.
- **Impact:** Accurate pagination counts and reduced data transfer.

---

## Recommended Next Steps (Priority Order)

### High Impact
1. **Migrate to React Query** - Add React Query to Vendors, Expenses, Products, Leads pages for automatic caching, background refetching, and stale-while-revalidate patterns. This will reduce redundant API calls and improve perceived performance.

2. **Implement Request Deduplication** - Add a request deduplication layer to prevent multiple simultaneous requests for the same resource.

3. **Add Attribute Selection** - Use `attributes` parameter in Sequelize queries for list views to avoid returning full models with unnecessary fields.

### Medium Impact
1. **Extend cache duration** - For stable reference data (e.g., pricing templates, product categories), increase cache duration from 60s to 5-10 minutes.

2. **Add pagination to more endpoints** - Ensure all list endpoints properly support and return pagination metadata.

### Low Impact (Nice to Have)
1. **Add batch endpoints** - For fetching multiple resources in a single request (e.g., batch customer lookup).

2. **Implement GraphQL** - For more flexible data fetching and reduced over-fetching on complex views.
