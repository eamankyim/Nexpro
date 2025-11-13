const { Tenant, UserTenant } = require('../models');

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

      if (!membership || membership.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this tenant'
        });
      }
    } else {
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

    res.locals.tenantId = tenantId;
    res.locals.tenant = req.tenant;
    res.locals.tenantRole = req.tenantRole;

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  tenantContext
};


