# System Health Page – Data Sources

The **System Health** page (`/admin/health`) loads all data from one API: **`GET /api/admin/health`**, implemented in `Backend/controllers/adminController.js` → `getSystemHealth`.

## Where each value comes from

| UI label | Source | Correct? |
|----------|--------|----------|
| **Server uptime** | `process.uptime()` (Node.js), formatted with `formatDuration()`. | Yes – runtime of the backend process. |
| **Started … ago** | `serverStartedAt` – set once when the server process starts (`new Date()` in adminController). | Yes. |
| **Database latency** | One `SELECT 1` query; latency = `Date.now() - dbStart` (ms). | Yes – round-trip DB ping. |
| **Database status** | Hardcoded `'online'` if the query above succeeds; otherwise the route would error. | Yes. |
| **Pending notifications** | `Notification.count({ where: { isRead: false } })` – **all unread notifications** in the DB (all tenants). | Yes – it’s the platform-wide unread count. |
| **Platform admins** | `User.count({ where: { isPlatformAdmin: true, isActive: true } })`. | Yes. |
| **Tenant status alerts** | **Misleading name.** Data is `Tenant.findAll` ordered by `createdAt DESC`, limit 5 – i.e. **5 most recently created tenants**, not “alerts”. | Data is correct; the section is really “Recent tenants”. |
| **Recent notifications** | `Notification.findAll` ordered by `createdAt DESC`, limit 5 – **5 latest notifications** across all tenants. | Yes. |

## Summary

- **Server uptime, DB latency, started-at, platform admins:** Correct and from the right sources.
- **Pending notifications:** Correct (total unread notifications platform-wide).
- **Recent notifications:** Correct (latest 5 notifications platform-wide).
- **“Tenant status alerts”:** The data is “5 most recent tenants (by creation date)”;
  the label suggests “alerts” (e.g. issues). Consider renaming the section to **“Recent tenants”** so the UI matches the data.

Frontend: `Frontend/src/pages/admin/AdminHealth.jsx` → `adminService.getSystemHealth()` → `GET /api/admin/health`.
