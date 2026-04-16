/**
 * Resolve frontend base URL for invite links.
 * Priority:
 * 1) Request origin/referer when it is an allowed ABS app host
 * 2) FRONTEND_URL env fallback
 */
const ABS_ALLOWED_HOSTS = new Set([
  'myapp.africanbusinesssuite.com',
  'demo.africanbusinesssuite.com',
  'africanbusinesssuite.com',
  'www.africanbusinesssuite.com',
  'localhost:3000',
  'localhost:5173',
]);

const normalizeBase = (raw) => {
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (_err) {
    return String(raw).replace(/\/+$/, '').replace(/\/onboarding$/i, '');
  }
};

const isAllowedHost = (host) => {
  const normalizedHost = String(host || '').toLowerCase();
  return ABS_ALLOWED_HOSTS.has(normalizedHost) || normalizedHost.endsWith('.africanbusinesssuite.com');
};

const getFrontendBaseUrl = (req) => {
  const candidate = req?.headers?.origin || req?.headers?.referer;
  if (candidate) {
    try {
      const parsed = new URL(candidate);
      if (isAllowedHost(parsed.host)) {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch (_err) {
      // Fall through to env fallback
    }
  }

  return normalizeBase(process.env.FRONTEND_URL || 'http://localhost:3000');
};

module.exports = {
  getFrontendBaseUrl,
};

