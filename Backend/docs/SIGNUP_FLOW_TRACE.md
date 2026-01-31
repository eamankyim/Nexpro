# Signup Flow Trace

## Summary

The signup API (`POST /api/tenants/signup`) was taking **~9 seconds** (now **~5.8s** after first pass, target **~3–4s**). With a **remote DB**, each round-trip adds ~100–300ms latency.

## Flow (tenantController.signupTenant) – Optimized

| Step | Round-trips | Notes |
|------|-------------|-------|
| 1. User.findOne | 1 | Check email exists |
| 2. sequelize.transaction() | 1 | BEGIN |
| 3. generateUniqueSlug() | **0** | ~~1–2 queries~~ Now uses random suffix – no DB check |
| 4. Tenant.create | 1 | INSERT |
| 5. User.create | 1 | INSERT + bcrypt hash (~100–300ms CPU) |
| 6. UserTenant.create | 1 | INSERT |
| 7. Setting.bulkCreate | 1 | Bulk INSERT (3 rows) |
| 8. transaction.commit() | 1 | COMMIT |
| 9. UserTenant.findAll | **0** | ~~1 query~~ Now build memberships from in-memory data |
| 10. res.json() | – | Return response |

**Total DB round-trips (optimized):** 6 (down from 8)

## Fixes Applied

1. **Category seeding** – Moved to background after response. Was 18+ sequential calls (~2–5s).
2. **generateUniqueSlug** – Uses `slug-{random}` instead of DB lookup. Saves 1 round-trip (~100–300ms).
3. **UserTenant.findAll** – Removed. Build `memberships` from `membershipRecord` + `tenant` in memory. Saves 1 round-trip (~100–300ms).
4. **bcrypt rounds** – Optional: set `BCRYPT_ROUNDS=8` in env for ~100–150ms savings (slightly weaker but OWASP-acceptable).

## Slug Format Change

Slugs now include a 6-char random suffix: `company-name-x7k2m9`. Prevents collisions without a DB check. If you need human-readable slugs (e.g. vanity URLs), revert `generateUniqueSlug` to the DB-check version.

## Remote DB Notes

- Each round-trip adds latency based on geography (e.g. 50–200ms per query).
- Pool config: `min: 2`, `max: 10` keeps connections warm.
- SSL adds some overhead for external DBs (Neon, AWS, etc.).

## How to Verify

1. Check Network tab – signup should be ~3–5s (depending on DB location).
2. Backend logs (NODE_ENV=development): `[signup] User.findOne: X ms`, `[signup] total: X ms`
3. Verify categories appear on Inventory/Products after signup (background seeding).
