/**
 * Database hosts by environment.
 *
 * - DEMO_CANONICAL: local dev + demo-api (nexpro-backend) — shared demo data
 * - PRODUCTION: production API (shopwise_backend / api.africanbusinesssuite.com) or VPS .env
 */

/** Shared Neon for localhost + demo-api */
const DEMO_CANONICAL_DB_HOST =
  'ep-dry-wildflower-ahm0na7f-pooler.c-3.us-east-1.aws.neon.tech';

/** Production Neon (Vercel shopwise_backend). VPS may use a different DATABASE_URL in server .env */
const PRODUCTION_DB_HOST =
  'ep-sweet-hall-ahwiqkrg-pooler.c-3.us-east-1.aws.neon.tech';

/** @deprecated use DEMO_CANONICAL_DB_HOST */
const CANONICAL_DB_HOST = DEMO_CANONICAL_DB_HOST;

/**
 * @param {string|undefined} databaseUrl
 * @returns {boolean}
 */
function isDemoCanonicalDatabaseUrl(databaseUrl) {
  if (!databaseUrl || typeof databaseUrl !== 'string') return false;
  return databaseUrl.includes(DEMO_CANONICAL_DB_HOST);
}

/**
 * @param {string|undefined} databaseUrl
 * @returns {boolean}
 */
function isProductionDatabaseUrl(databaseUrl) {
  if (!databaseUrl || typeof databaseUrl !== 'string') return false;
  return databaseUrl.includes(PRODUCTION_DB_HOST);
}

/**
 * @param {string|undefined} databaseUrl
 * @returns {string|null}
 */
function getDatabaseHost(databaseUrl) {
  if (!databaseUrl) return null;
  try {
    const normalized = databaseUrl.replace(/^postgresql:/, 'postgres:');
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

module.exports = {
  DEMO_CANONICAL_DB_HOST,
  PRODUCTION_DB_HOST,
  CANONICAL_DB_HOST,
  isDemoCanonicalDatabaseUrl,
  isCanonicalDatabaseUrl: isDemoCanonicalDatabaseUrl,
  isProductionDatabaseUrl,
  getDatabaseHost,
};
