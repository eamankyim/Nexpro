# Multi-Tenant Roles & Permissions

This document captures the baseline approach for handling tenants, roles, and permissions in **NEXPro**. Keep it updated as the authorization model evolves.

---

## 1. Core Concepts

- **Tenant**: Represents an organization/workspace. All data is scoped by `tenantId`.
- **User**: A person with access to one or more tenants. Users connect to tenants via a join table (`user_tenants`).
- **Role**: A named collection of permissions, defined per tenant.
- **Permission**: Canonical capability identifier (e.g. `leads.view`, `payroll.run`). The list is global and curated by us.

```
User --< UserTenantRole >-- Role --< RolePermission >-- Permission
               |
            Tenant
```

---

## 2. Default Roles

Seed these roles for every tenant so onboarding is frictionless:

| Role | Intended Users | Highlights |
| --- | --- | --- |
| **Owner** | Tenant founders, top admins | Full platform control: billing, invites, tenant settings. Immutable minimum permissions. |
| **Operations Manager** | Production & project leaders | Manage jobs, leads, customers, reports. Post to accounting/payroll but cannot alter tenant settings. |
| **Sales & Customer Success** | Sales reps, account managers | Leads, customers, quotes, invoices they own. Limited reporting; no HR/accounting maintenance. |
| **Finance / Accountant** | Finance team | Accounting ledger, AR/AP, invoices, expenses, payroll runs. |
| **HR & Payroll** | HR team | Employee records, documents, leave tracking, payroll configuration. |
| **Production Staff** | Operators, designers | Jobs assigned to them, document uploads, status updates. |
| **Support Staff** *(optional)* | Support desk | Read-only customer/job info for quick answers. |

Tenants can assign multiple roles per user (e.g. Finance + HR).

---

## 3. Permissions

- Maintain a **fixed catalog** of permission keys in the backend (`permissions` table or configuration file).
- Group them by module for UI friendliness (Sales, Operations, Finance, HR, System).
- Keep the semantics *positive*: permissions grant capabilities; we do not support deny rules.

Example permission keys:

```
leads.view, leads.create, leads.convert
jobs.assign, jobs.update_status
accounting.journal.post, accounting.reports.view
employees.manage, payroll.run
settings.manage_roles, settings.manage_subscription
```

---

## 4. Editing Roles (Tenant Admin UX)

Only users with `settings.manage_roles` (typically the Owner role) may update roles.

### Backend safeguards
- Scope all queries/mutations by `tenantId`.
- Validate payloads: reject unknown permission keys; prevent stripping essential Owner permissions.
- Use transactions when replacing role permissions.
- Audit log every change: who, when, what changed.
- Invalidate cached permission lookups after any edit.

### Frontend experience
- Fetch role + permission catalog via TanStack Query.
- Present grouped toggles (e.g. module-level switches expanding to granular options).
- On save, `PUT /api/tenants/:tenantId/roles/:roleId/permissions` with the full permission list.
- On success, invalidate `roles` and `permissions` queries so other sessions refresh.
- Show friendly errors from backend validation (e.g. attempting to remove mandatory Owner permissions).

---

## 5. Simplification Guardrails

1. **Fixed catalog** – tenants cannot create arbitrary permission strings.
2. **Role cap** – limit custom roles per tenant (e.g. max 5) to keep UI and audits manageable.
3. **Immutable Owner baseline** – ensure at least one active user keeps core admin powers.
4. **CRUD-style APIs** – avoid policy scripts. Stick with straightforward REST endpoints.
5. **Simple data model** – no inheritance or DENY rules; permissions stored as allow-lists.
6. **Caching discipline** – cache results (`tenantId`,`userId` → permission set) but clear cache on mutations.
7. **Documentation & transparency** – surface role → permission mappings in-app so tenants understand what each role can do.

---

## 6. Request Authorization Flow

1. **Authentication**: token includes `userId`; request supplies `X-Tenant-ID` or uses default tenant.
2. **Middleware**:
   - Verify user belongs to tenant.
   - Load roles and flatten permissions (use cache when possible).
   - Attach `req.permissions` for downstream handlers.
3. **Controllers/Services** call `authorize('permission.key')`.
4. **Queries** must always filter by tenant to avoid data leakage.

---

## 7. Future Considerations

- **Role Templates**: allow cloning of defaults for new tenants while retaining system updates.
- **Permission history**: optional versioning if audit requirements grow.
- **Real-time updates**: emit `role.updated` events to refresh active sessions automatically.
- **Self-serve insights**: provide reports showing which users have which permissions to simplify governance reviews.

---

## 8. Checklist

- [ ] Tables/migrations for roles, permissions, role_permissions, user_tenant_roles.
- [ ] Seed default roles + permissions per tenant.
- [ ] Middleware for tenant-scoped authorization.
- [ ] API endpoints for listing/updating roles and permissions.
- [ ] UI for owners to manage roles (grouped toggles, validation messages).
- [ ] Caching + invalidation strategy.
- [ ] Audit logging for role/permission changes.

Keep implementation disciplined against this design to avoid creeping complexity as we onboard more tenants.


