jest.mock('../../../models', () => ({
  PlatformAdminUserRole: { findAll: jest.fn() },
  PlatformAdminRole: {},
  PlatformAdminPermission: { findAll: jest.fn() },
}));

jest.mock('../../../middleware/cache', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

const {
  requirePlatformAdminPermission,
  requireAnyPlatformAdminPermission,
  requireAllPlatformAdminPermissions,
  hasPlatformAdminPermission,
  hasAnyPlatformAdminPermission,
  hasAllPlatformAdminPermissions,
} = require('../../../middleware/platformAdminPermissions');
const { PlatformAdminPermission } = require('../../../models');
const { cache } = require('../../../middleware/cache');

const createResponse = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };
  return res;
};

describe('platformAdminPermissions middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.get.mockReturnValue(['overview.view']);
    PlatformAdminPermission.findAll.mockResolvedValue([
      { key: 'overview.view' },
      { key: 'settings.view' },
      { key: 'roles.manage' },
    ]);
  });

  it('allows bootstrap super admins through single, any, and all permission gates with limited loaded permissions', async () => {
    const req = {
      user: {
        id: 'admin-1',
        email: 'superadmin@gmail.com',
        isPlatformAdmin: true,
      },
      platformAdminPermissionKeys: ['overview.view'],
    };
    const res = createResponse();
    const next = jest.fn();

    await requirePlatformAdminPermission('settings.view')(req, res, next);
    await requireAnyPlatformAdminPermission('settings.view', 'roles.manage')(req, res, next);
    await requireAllPlatformAdminPermissions('overview.view', 'settings.view', 'roles.manage')(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('loads all effective permissions for bootstrap super admins by email', async () => {
    const req = {
      user: {
        id: 'admin-1',
        email: 'SUPERADMIN@NEXPRO.COM',
        isPlatformAdmin: true,
      },
    };
    const res = createResponse();
    const next = jest.fn();
    cache.get.mockReturnValue(undefined);

    await requirePlatformAdminPermission('settings.view')(req, res, next);

    expect(PlatformAdminPermission.findAll).toHaveBeenCalledWith({ attributes: ['key'], raw: true });
    expect(req.platformAdminPermissionKeys).toEqual(['overview.view', 'settings.view', 'roles.manage']);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not let non-bootstrap platform admins bypass missing permissions', async () => {
    const req = {
      user: {
        id: 'admin-2',
        email: 'ops@example.com',
        isPlatformAdmin: true,
      },
      platformAdminPermissionKeys: ['overview.view'],
    };
    const res = createResponse();
    const next = jest.fn();

    await requireAllPlatformAdminPermissions('overview.view', 'settings.view')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('reports bootstrap super admins as having every permission for controller helpers', () => {
    const req = {
      user: {
        id: 'admin-1',
        email: 'superadmin@nexpro.com',
        isPlatformAdmin: true,
      },
      platformAdminPermissionKeys: ['overview.view'],
    };

    expect(hasPlatformAdminPermission(req, 'settings.view')).toBe(true);
    expect(hasAnyPlatformAdminPermission(req, 'settings.view', 'roles.manage')).toBe(true);
    expect(hasAllPlatformAdminPermissions(req, 'overview.view', 'settings.view')).toBe(true);
  });
});
