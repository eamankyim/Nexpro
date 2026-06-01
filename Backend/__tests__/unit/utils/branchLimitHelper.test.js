jest.mock('../../../models', () => ({
  Tenant: { findByPk: jest.fn() },
  SubscriptionPlan: { findOne: jest.fn() },
  Shop: { count: jest.fn() },
  StudioLocation: { count: jest.fn() },
  Pharmacy: { count: jest.fn() },
}));

const { Tenant, SubscriptionPlan, Shop, StudioLocation } = require('../../../models');
const {
  canAddBranch,
  validateBranchLimit,
} = require('../../../utils/branchLimitHelper');

describe('branchLimitHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks starter tenants after their first shop', async () => {
    Tenant.findByPk.mockResolvedValue({ id: 'tenant-1', plan: 'starter', metadata: {} });
    SubscriptionPlan.findOne.mockResolvedValue(null);
    Shop.count.mockResolvedValue(1);

    const result = await canAddBranch('tenant-1', 'shop');

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(1);
    expect(result.current).toBe(1);
  });

  it('allows professional tenants up to 3 studio locations', async () => {
    Tenant.findByPk.mockResolvedValue({ id: 'tenant-2', plan: 'professional', metadata: {} });
    SubscriptionPlan.findOne.mockResolvedValue(null);
    StudioLocation.count.mockResolvedValue(2);

    const result = await canAddBranch('tenant-2', 'studioLocation');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(3);
    expect(result.remaining).toBe(1);
  });

  it('uses enterprise tier branch overrides', async () => {
    Tenant.findByPk.mockResolvedValue({
      id: 'tenant-3',
      plan: 'enterprise',
      metadata: { entitlements: { enterpriseTier: 'business' } },
    });
    SubscriptionPlan.findOne.mockResolvedValue({
      planId: 'enterprise',
      name: 'Enterprise',
      branchLimit: null,
    });
    StudioLocation.count.mockResolvedValue(4);

    const result = await canAddBranch('tenant-3', 'studioLocation');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.remaining).toBe(1);
  });

  it('throws a 403 error when branch limit is exceeded', async () => {
    Tenant.findByPk.mockResolvedValue({ id: 'tenant-4', plan: 'starter', metadata: {} });
    SubscriptionPlan.findOne.mockResolvedValue(null);
    Shop.count.mockResolvedValue(1);

    await expect(validateBranchLimit('tenant-4', 'shop')).rejects.toMatchObject({
      code: 'BRANCH_LIMIT_EXCEEDED',
      statusCode: 403,
    });
  });
});
