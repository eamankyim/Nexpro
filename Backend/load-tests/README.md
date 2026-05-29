# Backend K6 Load Tests

Grafana K6 scripts for assessing backend API performance at 100, 200, and 300 concurrent virtual users.

These tests default to `http://localhost:5000` and intentionally refuse non-local targets unless `ALLOW_NON_LOCAL=true` is set. Only run load tests against local, staging, or other environments you own and have explicit permission to test.

## What Is Covered

The script exercises safe read-only traffic:

- Public endpoints: `/health`, `/api/auth/config`, `/api/public/pricing`
- Authenticated endpoints when credentials or a token are supplied: `/api/auth/me`, dashboard overview/revenue, customers, products, and jobs list endpoints

No create, update, delete, payment, webhook, or export endpoints are called.

## Install K6

K6 is a standalone binary, not an npm dependency.

```bash
# macOS
brew install k6

# Or run with Docker
docker run --rm -i grafana/k6 run - < ./load-tests/backend-load-test.js
```

## Start The Backend

From `Backend/`, start the API before running local tests:

```bash
npm run dev
```

The default target is `http://localhost:5000`.

## Run Profiles

From `Backend/`:

```bash
# 100 concurrent users
npm run load:k6:100

# 200 concurrent users
npm run load:k6:200

# 300 concurrent users
npm run load:k6:300
```

Equivalent direct K6 commands:

```bash
PROFILE=100 k6 run ./load-tests/backend-load-test.js
PROFILE=200 k6 run ./load-tests/backend-load-test.js
PROFILE=300 k6 run ./load-tests/backend-load-test.js
```

By default, each profile ramps up for 2 minutes, holds for 5 minutes, then ramps down for 1 minute. Tune durations when needed:

```bash
PROFILE=100 RAMP_UP=30s HOLD=1m RAMP_DOWN=30s k6 run ./load-tests/backend-load-test.js
```

## Authenticated Traffic

Authenticated endpoints are included only when a token or test login credentials are provided.

Use an existing bearer token:

```bash
AUTH_TOKEN="<jwt>" TENANT_ID="<tenant-id>" PROFILE=100 k6 run ./load-tests/backend-load-test.js
```

Or let setup log in once and reuse the returned JWT:

```bash
TEST_EMAIL="load-test@example.com" TEST_PASSWORD="password" PROFILE=100 k6 run ./load-tests/backend-load-test.js
```

`TENANT_ID` is optional if the login response has a default tenant membership. Use a dedicated test account with representative tenant data.

## Staging Targets

Never target production by accident. For staging or another approved target, set both `BASE_URL` and `ALLOW_NON_LOCAL=true`:

```bash
BASE_URL="https://staging-api.example.com" ALLOW_NON_LOCAL=true PROFILE=100 k6 run ./load-tests/backend-load-test.js
```

## Metrics To Watch

- `http_req_duration`: overall latency; this script thresholds p95 under 1000ms and p99 under 2500ms.
- `http_req_failed`: failed request rate; threshold is under 5%.
- `checks`: endpoint status checks; threshold is above 95%.
- `http_req_duration{type:public}` and `http_req_duration{type:authenticated}`: latency split by traffic type.
- Backend CPU, memory, database connections, slow queries, and rate-limit logs during the run.

If thresholds fail at 100 users, investigate before trying 200 or 300 users.
