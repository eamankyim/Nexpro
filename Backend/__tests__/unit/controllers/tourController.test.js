jest.mock('../../../models', () => ({
  UserTenant: {
    findOne: jest.fn(),
  },
}));

const { UserTenant } = require('../../../models');
const { getTourStatus } = require('../../../controllers/tourController');

const buildRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

describe('tourController.getTourStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty tours for platform admin support access without membership', async () => {
    const req = {
      user: { id: 'admin-1' },
      tenantId: 'tenant-1',
      isSupportAccess: true,
    };
    const res = buildRes();
    const next = jest.fn();

    await getTourStatus(req, res, next);

    expect(UserTenant.findOne).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { tours: {} },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns tours from user-tenant metadata for regular members', async () => {
    UserTenant.findOne.mockResolvedValue({
      metadata: {
        tours: {
          dashboard: { completed: true, completedAt: '2026-01-01T00:00:00.000Z' },
        },
      },
    });

    const req = {
      user: { id: 'user-1' },
      tenantId: 'tenant-1',
      isSupportAccess: false,
    };
    const res = buildRes();
    const next = jest.fn();

    await getTourStatus(req, res, next);

    expect(UserTenant.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', tenantId: 'tenant-1', status: 'active' },
    });
    expect(res.body).toEqual({
      success: true,
      data: {
        tours: {
          dashboard: { completed: true, completedAt: '2026-01-01T00:00:00.000Z' },
        },
      },
    });
  });

  it('returns 404 when membership is missing for non-support users', async () => {
    UserTenant.findOne.mockResolvedValue(null);

    const req = {
      user: { id: 'user-1' },
      tenantId: 'tenant-1',
    };
    const res = buildRes();
    const next = jest.fn();

    await getTourStatus(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: 'User-tenant relationship not found',
    });
  });
});
