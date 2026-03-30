# Go-live checklist (ABS)

Short checklist for production. **Implemented in repo:** dev-only routine logging (see below).

## Logging (done in codebase)

| Layer | Behavior |
|--------|-----------|
| **Frontend** | Production build uses Terser to strip `console.log`, `console.info`, `console.debug`, `console.trace`. `console.warn` / `console.error` remain for real issues. |
| **Backend** | When `NODE_ENV=production`, `console.log` / `debug` / `info` are no-ops after startup validation. `console.warn` / `console.error` remain. SSO verbose dump runs **only** in development. One `console.warn` on listen in production. |

Set `NODE_ENV=production` on your host (Railway, VPS, etc.).

## Before launch (manual)

- [ ] Secrets only in host env (never in git): `JWT_SECRET`, `DATABASE_URL`, Paystack, email, etc.
- [ ] `Frontend` / `Backend` env examples reviewed against production values.
- [ ] CORS / allowed origins match real app URLs.
- [ ] HTTPS everywhere; webhook URLs point to production.
- [ ] Database migrations applied; backup + restore tested once.
- [ ] Smoke test: [`E2E_TESTING_BY_TENANT_TYPE.md`](./E2E_TESTING_BY_TENANT_TYPE.md).
- [ ] Optional: error tracking (e.g. Sentry), uptime monitor, log drain.

## After launch

- [ ] Tag release (e.g. `v1.0.0`).
- [ ] Document on-call / rollback (redeploy previous build).
