# Mobile scope: Leads, Tasks, Deliveries (in scope)

**Status:** Product decision — these features **are required on mobile** (not web-only).

**Updated:** Reflects stakeholder change: Leads was previously treated as web-only; Tasks and Deliveries were web-only in practice (no mobile screens) but are now **explicit mobile targets**.

---

## In scope (build on mobile)

| Feature | Web reference | Mobile today |
|--------|----------------|--------------|
| **Leads** | [`Frontend/src/pages/Leads.jsx`](../../Frontend/src/pages/Leads.jsx), route `/leads`, feature flag `leadPipeline` | Not implemented — **add** |
| **Tasks** | [`Frontend/src/pages/Tasks.jsx`](../../Frontend/src/pages/Tasks.jsx), route `/tasks` | Not implemented — **add** |
| **Deliveries** | [`Frontend/src/pages/Deliveries.jsx`](../../Frontend/src/pages/Deliveries.jsx), route `/deliveries`, feature `deliveries` | Not implemented — **add** |

Implementation should reuse the same backend APIs and patterns as web (`Frontend/src/services/…`), adapted to Expo Router + React Native UI per [`.cursor/rules/mobile-expo.mdc`](../../.cursor/rules/mobile-expo.mdc) and [`.cursor/rules/mobile-app-design.mdc`](../../.cursor/rules/mobile-app-design.mdc).

---

## Cursor rules change (execute when leaving plan mode)

**Remove `Leads` from the mobile “out of scope” lists** so agents do not block lead work:

1. **[`.cursorrules`](../../.cursorrules)** — Under *Mobile App (Expo)*, change the out-of-scope bullet to **omit Leads** (keep: Vendors, Employees, Payroll, Users/Team, Prescriptions, Drugs, Foot Traffic, Accounting, plus any other exclusions you already added: platform admin, Automations, Marketing, Reports, Export data, Pricing — only if those edits were applied; if not, align with latest product list).

2. **[`.cursor/rules/mobile-expo.mdc`](../../.cursor/rules/mobile-expo.mdc)** — Remove the `Leads` line from *Mobile App — Out of Scope*.

**Optional positive guidance** (same two files or `mobile-expo.mdc` only): add a short *In scope / roadmap* note that **Leads**, **Tasks**, and **Deliveries** are valid mobile features when flagged for the tenant.

---

## Still out of scope on mobile (unchanged from prior direction)

Unless product changes again: **Platform admin**, **Automations**, **Marketing**, **Reports** (hubs), **Export data**, **Pricing templates**, plus existing web-only: Vendors, Employees, Payroll, Users/Team, Prescriptions, Drugs, Foot Traffic, Accounting.

---

## Implementation todos (for execution phase)

1. Update `.cursorrules` and `mobile-expo.mdc` as above.
2. Add Expo routes + navigation entry points (e.g. More menu and/or tabs) gated by `hasFeature` / business type like web.
3. Port or thin-wrap lead, task, and delivery API clients from web services into `mobile/services/`.
4. Build RN screens with existing mobile patterns (lists, detail, pull-to-refresh, offline where applicable).
