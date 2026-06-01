jest.mock('../../../models', () => ({
  PlatformAdminRole: {},
  PlatformAdminPermission: { findAll: jest.fn() },
  PlatformAdminRolePermission: {},
  PlatformAdminUserRole: { findAll: jest.fn() },
  User: { findByPk: jest.fn() },
}));

jest.mock('../../../utils/paginationUtils', () => ({
  getPagination: jest.fn(() => ({ page: 1, limit: 20, offset: 0 })),
}));

const {
  PlatformAdminPermission,
  PlatformAdminUserRole,
  User,
} = require('../../../models');
const platformAdminRoleController = require('../../../controllers/platformAdminRoleController');

const createResponse = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };
  return res;
};

describe('platformAdminRoleController.getUserPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not grant all permissions to a non-bootstrap platform admin with no assigned role permissions', async () => {
    User.findByPk.mockResolvedValue({
      id: 'admin-1',
      email: 'ops@example.com',
      isPlatformAdmin: true,
    });
    PlatformAdminUserRole.findAll.mockResolvedValue([]);

    const req = { params: { userId: 'admin-1' } };
    const res = createResponse();
    const next = jest.fn();

    await platformAdminRoleController.getUserPermissions(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(PlatformAdminPermission.findAll).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [],
      grouped: {},
      roles: [],
    });
  });

  it('returns all permissions for the bootstrap super admin even when assigned roles are limited', async () => {
    User.findByPk.mockResolvedValue({
      id: 'admin-1',
      email: 'superadmin@nexpro.com',
      isPlatformAdmin: true,
    });
    PlatformAdminUserRole.findAll.mockResolvedValue([
      {
        role: {
          id: 'role-1',
          name: 'Support',
          department: 'Support',
          permissions: [
            {
              id: 'perm-limited',
              key: 'overview.view',
              name: 'View Overview',
              description: 'View platform overview dashboard',
              category: 'overview',
            },
          ],
        },
      },
    ]);
    PlatformAdminPermission.findAll.mockResolvedValue([
      {
        id: 'perm-1',
        key: 'overview.view',
        name: 'View Overview',
        description: 'View platform overview dashboard',
        category: 'overview',
      },
      {
        id: 'perm-2',
        key: 'settings.view',
        name: 'View Settings',
        description: 'View platform settings',
        category: 'settings',
      },
    ]);

    const req = { params: { userId: 'admin-1' } };
    const res = createResponse();
    const next = jest.fn();

    await platformAdminRoleController.getUserPermissions(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(PlatformAdminPermission.findAll).toHaveBeenCalledWith({
      attributes: ['id', 'key', 'name', 'description', 'category'],
    });
    expect(res.json.mock.calls[0][0].data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'overview.view' }),
        expect.objectContaining({ key: 'settings.view' }),
      ])
    );
  });
});
