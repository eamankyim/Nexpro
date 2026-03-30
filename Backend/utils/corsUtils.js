/**
 * Shared CORS utilities - single source of truth for allowed origins.
 * Used by config (cors middleware), CSRF, and explicit OPTIONS handler.
 */

const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4321',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://myapp.africanbusinesssuite.com',
  'https://africanbusinesssuite.com',
  'https://www.africanbusinesssuite.com',
];

/**
 * Normalize origin (trim, remove trailing slash)
 * @param {string} o - Raw origin string
 * @returns {string}
 */
const normalize = (o) => (o || '').trim().replace(/\/$/, '');

/**
 * Get allowed origins from env (CORS_ORIGIN, FRONTEND_URL) + defaults.
 * @returns {string[]}
 */
const getAllowedOrigins = () => {
  const fromEnv = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(normalize).filter(Boolean)
    : [];
  const fromFrontend = process.env.FRONTEND_URL
    ? [normalize(process.env.FRONTEND_URL)]
    : [];
  return [...new Set([...fromEnv, ...fromFrontend, ...DEFAULT_ORIGINS])];
};

/**
 * Check if origin is a LAN address (mobile testing)
 * e.g. http://192.168.0.124:3000 or http://10.0.0.5:3000
 */
const isLanOrigin = (o) => {
  try {
    const u = new URL(o);
    const isPrivate =
      u.hostname.startsWith('192.168.') ||
      u.hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(u.hostname);
    const portOk = !u.port || /^\d+$/.test(u.port);
    return !!(isPrivate && portOk && (u.protocol === 'http:' || u.protocol === 'https:'));
  } catch {
    return false;
  }
};

/**
 * Check if an origin is allowed (exact match, vercel.app, or Cloudflare Pages *.pages.dev)
 * @param {string} origin - Request origin
 * @returns {boolean}
 */
const isOriginAllowed = (origin) => {
  if (!origin) return false;
  const o = normalize(origin);
  if (o.includes('vercel.app')) return true;
  if (o.includes('pages.dev')) return true;
  const notProduction = process.env.NODE_ENV !== 'production';
  if (notProduction && (o.includes('localhost') || o.includes('127.0.0.1'))) return true;
  if (notProduction && isLanOrigin(o)) return true;
  if (isLanOrigin(o)) {
    console.warn('[CORS] LAN origin rejected (NODE_ENV=%s). Set NODE_ENV=development for mobile testing: %s', process.env.NODE_ENV, o);
  }
  return getAllowedOrigins().includes(o);
};

/**
 * CORS headers for preflight (OPTIONS) and normal responses.
 * Only sets Allow-Origin when origin is allowed; always sets Methods/Headers/Credentials/Max-Age.
 * @param {object} res - Express response
 * @param {string} origin - Request Origin header
 * @returns {boolean} - True if origin was allowed and Allow-Origin was set
 */
const setCorsHeaders = (res, origin) => {
  const allowed = !!(origin && isOriginAllowed(origin));
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', normalize(origin));
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, x-tenant-id, Accept, Accept-Language, Accept-Encoding, Cache-Control, Pragma'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  return allowed;
};

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  setCorsHeaders,
  normalize,
};
