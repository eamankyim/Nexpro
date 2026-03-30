# Tenant workspace roles — access matrix (ABS)

This document reflects **current** behaviour after hardening user management and aligning navigation with API rules. Roles are stored on **`user_tenants.role`** (and mirrored on `users.role` for invite signups). The API uses **`getEffectiveRole`** in `Backend/middleware/auth.js`: **`owner` / `admin` → `admin`**, **`manager` / `staff`** use membership role.

## Summary

| Capability | Staff | Manager | Admin / Owner |
|------------|:-----:|:-------:|:-------------:|
| Operational modules (sales, jobs, customers, invoices, POS, etc.) | Yes (per route) | Yes | Yes |
| **Data & Reports**, **Export data** | No (nav + route gate) | Yes | Yes |
| **Settings** (workspace) | No (nav + route gate) | Yes | Yes |
| **Payroll**, **Accounting**, **Employees** | No (nav + route gate; API manager+) | Yes | Yes |
| **Checkout** (plan upgrade / subscription payment) | No (route gate; API is manager+) | Yes | Yes |
| **Profile** (`/profile`) | Yes (simple account view) | Redirects to Settings → profile tab | Redirects to Settings → profile tab |
| **Users** — list / view directory | No | Yes | Yes |
| **Users** — create, update, remove, toggle status | No | No | Yes |
| **Invites** (generate, revoke, pending table) | No | No | Yes |
| **Exports** (entity CSV from list pages) | No (most routes) | Yes | Yes |
| **Expense approve / reject** | No | No | Admin only |
| **Delete sale** | No | No | Admin only |
| **Stock count approve / delete** | No | No | Admin only |

## Backend: `/api/users`

| Method | Roles |
|--------|--------|
| `GET /` | `admin`, `manager` |
| `GET /:id` | `admin`, `manager` |
| `POST /` | `admin` |
| `PUT /:id` | `admin` |
| `DELETE /:id` | `admin` |
| `PUT /:id/toggle-status` | `admin` |

Invites remain under **`/api/invites`** — **admin** only (unchanged).

## Backend: `/api/employees`

All methods (including `GET`) require **`admin`** or **`manager`** — **staff** cannot list or read employee records.

## Frontend

- **`RequireWorkspaceManager`**: blocks **staff** from `/settings`, `/export-data`, `/reports/*`, `/users`, `/employees` (direct URL or bookmark).
- **Sidebar**: **Data & Reports**, **Users**, **Settings**, **Payroll**, **Accounting**, **Employees** (under Advanced) use `managerOnly` where applicable; staff do not see those entries.
- **Header**: **Settings** and **Upgrade** (trial/free) are shown only to managers; **Profile** is always available (staff get account info; managers redirect from `/profile` to Settings).
- **Users** page: managers see list + filters + refresh; **Invite**, **pending invites**, and **active toggle** remain **admin-only**.
- **Payment collection** banner and **POS** “set up payment” screen: staff see instructions to ask an administrator; managers get the button to open Settings.

## Maintenance

When adding a new **sensitive** route or nav item, decide:

1. Is it **staff-safe** (operational) or **manager+** (reporting, exports, configuration)?
2. Add matching **`authorize(...)`** on the API and **nav flags** / **`RequireWorkspaceManager`** if needed.

See also `docs/tenancy-rbac.md` for the longer-term RBAC design (not all items are implemented yet).
