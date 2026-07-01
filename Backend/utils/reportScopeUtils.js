const { applyTenantFilter } = require('./tenantUtils');
const { applyScopedFilters, getShopSqlFragment } = require('./shopUtils');
const { getStudioLocationSqlFragment } = require('./studioLocationUtils');

/**
 * Tenant + active shop/studio location filter for report queries (strict scope).
 * Mirrors invoice list visibility (`applyScopedFilters`).
 * @param {object} req
 * @param {object} [extra]
 */
const scopedReportWhere = (req, extra = {}) =>
  applyScopedFilters(req, applyTenantFilter(req.tenantId, extra));

/**
 * SQL scope fragment for job-backed raw queries (studio locations).
 * @param {object} req
 * @returns {{ sql: string, replacements: object }}
 */
const jobScopeSqlFragment = (req) => getStudioLocationSqlFragment(req, 'job');

/**
 * SQL scope fragment for invoice-backed raw queries (shop + studio location).
 * @param {object} req
 * @param {string} [tableAlias]
 * @returns {{ sql: string, replacements: object }}
 */
const documentScopeSqlFragment = (req, tableAlias = '') => {
  const shop = getShopSqlFragment(req, tableAlias);
  const studio = getStudioLocationSqlFragment(req, tableAlias);
  return {
    sql: `${shop.sql}${studio.sql}`,
    replacements: { ...shop.replacements, ...studio.replacements },
  };
};

module.exports = {
  scopedReportWhere,
  jobScopeSqlFragment,
  documentScopeSqlFragment,
};
