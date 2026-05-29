import http from 'k6/http';
import { check, fail, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const PROFILE = String(__ENV.PROFILE || '100');
const RAMP_UP = __ENV.RAMP_UP || '2m';
const HOLD = __ENV.HOLD || '5m';
const RAMP_DOWN = __ENV.RAMP_DOWN || '1m';
const THINK_TIME_MIN = Number(__ENV.THINK_TIME_MIN || '0.5');
const THINK_TIME_MAX = Number(__ENV.THINK_TIME_MAX || '2');
const VU_PROFILES = {
  100: 100,
  200: 200,
  300: 300,
};

const selectedVus = VU_PROFILES[PROFILE];
if (!selectedVus) {
  throw new Error(`Unsupported PROFILE "${PROFILE}". Use one of: ${Object.keys(VU_PROFILES).join(', ')}`);
}

const hasAuthConfiguration = Boolean(__ENV.AUTH_TOKEN || (__ENV.TEST_EMAIL && __ENV.TEST_PASSWORD));

const endpointFailures = new Rate('endpoint_failures');
const endpointDuration = new Trend('endpoint_duration');

export const options = {
  scenarios: {
    [`backend_${PROFILE}_concurrent_users`]: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP, target: selectedVus },
        { duration: HOLD, target: selectedVus },
        { duration: RAMP_DOWN, target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000', 'p(99)<2500'],
    'http_req_duration{type:public}': ['p(95)<750'],
    checks: ['rate>0.95'],
    ...(hasAuthConfiguration
      ? {
          'http_req_duration{type:authenticated}': ['p(95)<1500'],
          'endpoint_failures{endpoint:auth_me}': ['rate<0.05'],
          'endpoint_failures{endpoint:dashboard_overview}': ['rate<0.05'],
          'endpoint_failures{endpoint:dashboard_revenue_by_month}': ['rate<0.05'],
          'endpoint_failures{endpoint:dashboard_expenses_by_category}': ['rate<0.05'],
          'endpoint_failures{endpoint:dashboard_top_customers}': ['rate<0.05'],
          'endpoint_failures{endpoint:dashboard_job_status_distribution}': ['rate<0.05'],
          'endpoint_failures{endpoint:customers_list}': ['rate<0.05'],
          'endpoint_failures{endpoint:customers_stats}': ['rate<0.05'],
          'endpoint_failures{endpoint:products_list}': ['rate<0.05'],
          'endpoint_failures{endpoint:products_stats}': ['rate<0.05'],
          'endpoint_failures{endpoint:products_categories}': ['rate<0.05'],
          'endpoint_failures{endpoint:jobs_list}': ['rate<0.05'],
          'endpoint_failures{endpoint:jobs_stats}': ['rate<0.05'],
          'endpoint_failures{endpoint:jobs_categories}': ['rate<0.05'],
          'endpoint_failures{endpoint:expenses_list}': ['rate<0.05'],
          'endpoint_failures{endpoint:expenses_stats}': ['rate<0.05'],
          'endpoint_failures{endpoint:expenses_categories}': ['rate<0.05'],
          'endpoint_failures{endpoint:invoices_list}': ['rate<0.05'],
          'endpoint_failures{endpoint:invoices_stats}': ['rate<0.05'],
          'endpoint_failures{endpoint:sales_list}': ['rate<0.05'],
          'endpoint_failures{endpoint:reports_overview_phase1}': ['rate<0.05'],
          'endpoint_failures{endpoint:reports_revenue}': ['rate<0.05'],
          'endpoint_failures{endpoint:reports_expenses}': ['rate<0.05'],
          'endpoint_failures{endpoint:reports_sales}': ['rate<0.05'],
        }
      : {}),
  },
};

const publicEndpoints = [
  ['GET', '/health', 'health'],
  ['GET', '/api/auth/config', 'auth_config'],
  ['GET', '/api/public/pricing', 'public_pricing'],
];

const reportStartDate = __ENV.REPORT_START_DATE || '2026-01-01';
const reportEndDate = __ENV.REPORT_END_DATE || '2026-12-31';
const dateRangeQuery = `startDate=${reportStartDate}&endDate=${reportEndDate}`;

const authenticatedEndpoints = [
  ['GET', '/api/auth/me', 'auth_me'],
  ['GET', `/api/dashboard/overview?${dateRangeQuery}&filterType=year`, 'dashboard_overview'],
  ['GET', '/api/dashboard/revenue-by-month', 'dashboard_revenue_by_month'],
  ['GET', '/api/dashboard/expenses-by-category', 'dashboard_expenses_by_category'],
  ['GET', '/api/dashboard/top-customers', 'dashboard_top_customers'],
  ['GET', '/api/dashboard/job-status-distribution', 'dashboard_job_status_distribution'],
  ['GET', '/api/customers?page=1&limit=20', 'customers_list'],
  ['GET', '/api/customers/stats', 'customers_stats'],
  ['GET', '/api/products?page=1&limit=20', 'products_list'],
  ['GET', '/api/products/stats', 'products_stats'],
  ['GET', '/api/products/categories', 'products_categories'],
  ['GET', '/api/jobs?page=1&limit=20', 'jobs_list'],
  ['GET', '/api/jobs/stats/overview', 'jobs_stats'],
  ['GET', '/api/jobs/categories', 'jobs_categories'],
  ['GET', '/api/expenses?page=1&limit=20', 'expenses_list'],
  ['GET', '/api/expenses/stats/overview', 'expenses_stats'],
  ['GET', '/api/expenses/categories', 'expenses_categories'],
  ['GET', '/api/invoices?page=1&limit=20', 'invoices_list'],
  ['GET', '/api/invoices/stats/summary', 'invoices_stats'],
  ['GET', '/api/sales?page=1&limit=20', 'sales_list'],
  ['GET', `/api/reports/overview/phase1?${dateRangeQuery}`, 'reports_overview_phase1'],
  ['GET', `/api/reports/revenue?${dateRangeQuery}&groupBy=month`, 'reports_revenue'],
  ['GET', `/api/reports/expenses?${dateRangeQuery}&groupBy=category`, 'reports_expenses'],
  ['GET', `/api/reports/sales?${dateRangeQuery}`, 'reports_sales'],
];

const isLocalTarget = (url) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(url);

const buildJsonHeaders = () => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
});

const requestParams = (type, endpoint, extraHeaders = {}) => ({
  headers: {
    ...buildJsonHeaders(),
    ...extraHeaders,
  },
  tags: {
    type,
    endpoint,
  },
});

const extractAuth = (body) => {
  if (!body) return {};

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return {};
  }

  const data = parsed.data || parsed;
  const memberships = data.memberships || [];
  const defaultMembership = memberships.find((membership) => membership.isDefault) || memberships[0] || {};

  return {
    token: data.token,
    tenantId: __ENV.TENANT_ID || data.defaultTenantId || defaultMembership.tenantId || '',
  };
};

export function setup() {
  if (!isLocalTarget(BASE_URL) && __ENV.ALLOW_NON_LOCAL !== 'true') {
    fail(
      `Refusing to run load test against non-local BASE_URL "${BASE_URL}". ` +
        'Set ALLOW_NON_LOCAL=true only for staging or other targets you own and have permission to test.'
    );
  }

  const auth = {
    token: __ENV.AUTH_TOKEN || '',
    tenantId: __ENV.TENANT_ID || '',
  };

  if (!auth.token && __ENV.TEST_EMAIL && __ENV.TEST_PASSWORD) {
    const loginResponse = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: __ENV.TEST_EMAIL,
        password: __ENV.TEST_PASSWORD,
      }),
      requestParams('setup', 'auth_login')
    );

    const loginOk = check(loginResponse, {
      'login returned 200': (res) => res.status === 200,
      'login returned token': (res) => Boolean(extractAuth(res.body).token),
    });

    if (!loginOk) {
      fail(`Login failed for TEST_EMAIL at ${BASE_URL}/api/auth/login. Check credentials and target environment.`);
    }

    const loginAuth = extractAuth(loginResponse.body);
    auth.token = loginAuth.token;
    auth.tenantId = loginAuth.tenantId;
  }

  return {
    auth,
    includeAuthenticatedTraffic: Boolean(auth.token),
  };
}

export default function (data) {
  group('public read endpoints', () => {
    for (const [method, path, endpoint] of publicEndpoints) {
      const response = http.request(method, `${BASE_URL}${path}`, null, requestParams('public', endpoint));
      check(response, {
        [`${endpoint} status is 2xx/3xx`]: (res) => res.status >= 200 && res.status < 400,
      });
    }
  });

  if (data.includeAuthenticatedTraffic) {
    const authHeaders = {
      Authorization: `Bearer ${data.auth.token}`,
      ...(data.auth.tenantId ? { 'X-Tenant-Id': data.auth.tenantId } : {}),
    };

    group('authenticated read endpoints', () => {
      for (const [method, path, endpoint] of authenticatedEndpoints) {
        const response = http.request(
          method,
          `${BASE_URL}${path}`,
          null,
          requestParams('authenticated', endpoint, authHeaders)
        );
        const success = response.status >= 200 && response.status < 400;
        endpointFailures.add(!success, { endpoint, status: String(response.status), type: 'authenticated' });
        endpointDuration.add(response.timings.duration, { endpoint, status: String(response.status), type: 'authenticated' });
        check(response, {
          [`${endpoint} status is 2xx/3xx`]: () => success,
        });
      }
    });
  }

  sleep(Math.random() * (THINK_TIME_MAX - THINK_TIME_MIN) + THINK_TIME_MIN);
}
