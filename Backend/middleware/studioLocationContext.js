const { resolveBusinessType } = require('../config/businessTypes');
const {
  hasWorkspaceWideStudioAccess,
  getUserStudioLocationIds,
  ensureDefaultStudioLocation,
} = require('../utils/studioLocationUtils');

const resolveHeaderLocationId = (req) => {
  const raw =
    req.headers['x-studio-location-id'] ||
    req.headers['x-studio-location'] ||
    req.query?.studioLocationId;
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
      req.tenant?.name || 'Main studio'
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
      if (
        !req.canAccessAllStudioLocations &&
        !allowedIds.includes(requestedId)
      ) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this studio location',
        });
      }
      if (req.canAccessAllStudioLocations || allowedIds.includes(requestedId)) {
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
