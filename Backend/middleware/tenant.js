const { Tenant, UserTenant } = require('../models');
const {
  cache,
  TENANT_MEMBERSHIP_TTL,
  getTenantMembershipCacheKey,
  getTenantDefaultCacheKey
} = require('./cache');

const resolveTenantId = (req) => {
  const headerTenant =
    req.headers['x-tenant-id'] ||
    req.headers['x-tenant'] ||
    req.headers['tenant-id'];

  if (headerTenant) {
    return headerTenant;
  }

  if (req.query?.tenantId) {
    return req.query.tenantId;
  }

  if (req.body?.tenantId) {
    return req.body.tenantId;
  }

  return null;
};

const tenantContext = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before tenant resolution'
      });
    }

    let tenantId = resolveTenantId(req);

    let membership;

    if (tenantId) {
      const cacheKey = getTenantMembershipCacheKey(req.user.id, tenantId);
      membership = cache.get(cacheKey);

      if (!membership) {
        membership = await UserTenant.findOne({
          where: {
            userId: req.user.id,
            tenantId
          },
          include: [
            {
              model: Tenant,
              as: 'tenant'
            }
          ]
        });

        if (membership) {
          cache.set(cacheKey, membership, TENANT_MEMBERSHIP_TTL);
        }
      }

      if (!membership || membership.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this tenant'
        });
      }
    } else {
      const cacheKey = getTenantDefaultCacheKey(req.user.id);
      membership = cache.get(cacheKey);

      if (!membership) {
        membership = await UserTenant.findOne({
          where: {
            userId: req.user.id,
            status: 'active'
          },
          include: [
            {
              model: Tenant,
              as: 'tenant'
            }
          ],
          order: [
            ['isDefault', 'DESC'],
            ['createdAt', 'ASC']
          ]
        });

        if (membership) {
          cache.set(cacheKey, membership, TENANT_MEMBERSHIP_TTL);
        }
      }

      if (!membership) {
        return res.status(400).json({
          success: false,
          message: 'No tenant context provided and user has no active tenant membership'
        });
      }

      tenantId = membership.tenantId;
    }

    req.tenantId = tenantId;
    req.tenantMembership = membership;
    req.tenantRole = membership.role;
    req.tenant = membership.tenant || (await membership.getTenant());

    if (req.tenant?.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Workspace access is suspended. Contact support.'
      });
    }

    const entitlements = req.tenant?.metadata?.entitlements || {};
    const accessState = entitlements?.accessState || (req.tenant?.status === 'paused' ? 'restricted' : 'active');
    const isReadMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);

    if (accessState === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Workspace access is suspended. Contact support.'
      });
    }
    if (accessState === 'read_only' && !isReadMethod) {
      return res.status(403).json({
        success: false,
        message: 'Workspace is in read-only mode. Writes are disabled by platform admin.'
      });
    }
    if (accessState === 'restricted' && !isReadMethod) {
      return res.status(403).json({
        success: false,
        message: 'Workspace is temporarily restricted. Writes are disabled by platform admin.'
      });
    }

    res.locals.tenantId = tenantId;
    res.locals.tenant = req.tenant;
    res.locals.tenantRole = req.tenantRole;
    res.locals.tenantAccessState = accessState;

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  tenantContext
};


