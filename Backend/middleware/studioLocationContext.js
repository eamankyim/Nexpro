const { resolveBusinessType } = require('../config/businessTypes');
const {
  hasWorkspaceWideStudioAccess,
  getUserStudioLocationIds,
  ensureDefaultStudioLocation,
} = require('../utils/studioLocationUtils');

const resolveHeaderLocationId = (req) => {
  const raw =
    req.query?.studioLocationId ||
    req.headers['x-studio-location-id'] ||
    req.headers['x-studio-location'];
  if (!raw || raw === 'all') return null;
  return String(raw).trim();
};

/**
 * Resolves studio location scope for studio-type tenants.
 * Must run after tenantContext.
 */
const studioLocationContext = async (req, res, next) => {
  try {
    const businessType = resolveBusinessType(req.tenant?.businessType);
    if (businessType !== 'studio') {
      req.studioLocationScoped = false;
      return next();
    }

    req.studioLocationScoped = true;

    const defaultLocation = await ensureDefaultStudioLocation(
      req.tenantId,
      {
        name: req.tenant?.name || 'Main studio',
        studioType:
          req.tenant?.metadata?.studioType ||
          req.tenant?.metadata?.businessSubType ||
          null,
      }
    );
    req.defaultStudioLocationId = defaultLocation.id;

    const allowedIds = await getUserStudioLocationIds(
      req.user.id,
      req.tenantId,
      req.tenantRole
    );

    if (!allowedIds.length && !hasWorkspaceWideStudioAccess(req.tenantRole)) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to any studio location. Contact your administrator.',
      });
    }

    req.allowedStudioLocationIds = allowedIds;
    req.canAccessAllStudioLocations = hasWorkspaceWideStudioAccess(req.tenantRole);

    const requestedId = resolveHeaderLocationId(req);

    if (requestedId) {
      if (!allowedIds.includes(requestedId)) {
        if (!req.canAccessAllStudioLocations) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this studio location',
          });
        }
        // Ignore invalid/stale x-studio-location-id (e.g. cached in browser) — fall through to default.
      } else {
        req.studioLocationFilterId = requestedId;
      }
    } else if (!req.canAccessAllStudioLocations && allowedIds.length === 1) {
      req.studioLocationFilterId = allowedIds[0];
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { studioLocationContext };
