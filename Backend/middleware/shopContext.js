const { resolveBusinessType } = require('../config/businessTypes');
const {
  hasWorkspaceWideShopAccess,
  getUserShopIds,
  ensureDefaultShop,
} = require('../utils/shopUtils');

const resolveHeaderShopId = (req) => {
  const raw =
    req.headers['x-shop-id'] ||
    req.headers['x-shop'] ||
    req.query?.shopId;
  if (!raw || raw === 'all') return null;
  return String(raw).trim();
};

const isShopAccessRoute = (req) =>
  req.method === 'GET' && (req.path === '/access' || req.path.endsWith('/access'));

/**
 * Resolves shop scope for retail (shop) tenants.
 * Must run after tenantContext.
 */
const shopContext = async (req, res, next) => {
  try {
    const businessType = resolveBusinessType(req.tenant?.businessType);
    if (businessType !== 'shop') {
      req.shopScoped = false;
      return next();
    }

    req.shopScoped = true;

    const defaultShop = await ensureDefaultShop(
      req.tenantId,
      req.tenant?.name || 'Main shop'
    );
    req.defaultShopId = defaultShop?.id || null;

    const allowedIds = await getUserShopIds(
      req.user.id,
      req.tenantId,
      req.tenantRole
    );

    if (!allowedIds.length && !hasWorkspaceWideShopAccess(req.tenantRole)) {
      if (!isShopAccessRoute(req)) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to any shop. Contact your administrator.',
        });
      }
    }

    req.allowedShopIds = allowedIds;
    req.canAccessAllShops = hasWorkspaceWideShopAccess(req.tenantRole);

    const requestedId = resolveHeaderShopId(req);

    if (requestedId) {
      const canUseRequested =
        req.canAccessAllShops || allowedIds.includes(requestedId);
      if (canUseRequested) {
        req.shopFilterId = requestedId;
      }
      // Ignore invalid/stale x-shop-id (e.g. admin shop cached in browser) — fall through to default.
    } else if (!req.canAccessAllShops && allowedIds.length >= 1) {
      const preferred =
        req.defaultShopId && allowedIds.includes(req.defaultShopId)
          ? req.defaultShopId
          : allowedIds[0];
      req.shopFilterId = preferred;
    }

    // Admins/owners must always view one shop at a time (no tenant-wide "all shops" aggregate).
    if (!req.shopFilterId) {
      const fallback =
        req.defaultShopId && (req.canAccessAllShops || allowedIds.includes(req.defaultShopId))
          ? req.defaultShopId
          : allowedIds[0] || null;
      if (fallback) {
        req.shopFilterId = fallback;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { shopContext };
