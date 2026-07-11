/**
 * Build public order-tracking URLs for customer notifications.
 * Sales use tenant slug lookup (/track/:tenantSlug), not job viewToken links.
 */

/**
 * @param {{ tenantSlug?: string|null, orderNumber?: string|null }} params
 * @returns {string|null}
 */
function buildOrderTrackingLink({ tenantSlug = null, orderNumber = null } = {}) {
  const slug = String(tenantSlug || '').trim();
  if (!slug) return null;

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const base = `${frontendUrl}/track/${encodeURIComponent(slug)}`;
  const order = String(orderNumber || '').trim();
  if (order) {
    return `${base}?order=${encodeURIComponent(order)}`;
  }
  return base;
}

/**
 * Resolve tenant slug and build a tracking link for a sale/order.
 * @param {string} tenantId
 * @param {{ orderNumber?: string|null, TenantModel?: { findByPk: Function } }} [options]
 * @returns {Promise<string|null>}
 */
async function resolveOrderTrackingLink(tenantId, options = {}) {
  if (!tenantId) return null;
  const { orderNumber = null, TenantModel = null } = options;
  const Tenant = TenantModel || require('../models').Tenant;
  const tenant = await Tenant.findByPk(tenantId, { attributes: ['id', 'slug'] });
  return buildOrderTrackingLink({
    tenantSlug: tenant?.slug,
    orderNumber,
  });
}

module.exports = {
  buildOrderTrackingLink,
  resolveOrderTrackingLink,
};
