jest.mock('../../../models', () => ({
  Tenant: { findByPk: jest.fn() },
  Shop: {
    count: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  StudioLocation: {
    count: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Pharmacy: {
    count: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Setting: { findOne: jest.fn() },
}));

jest.mock('../../../utils/documentOrganizationUtils', () => ({
  loadTenantOrganization: jest.fn(),
}));

const { Tenant, Shop, StudioLocation, Setting } = require('../../../models');
const { loadTenantOrganization } = require('../../../utils/documentOrganizationUtils');
const {
  extractBranchIdsFromContext,
  resolveBusinessNameForContext,
} = require('../../../utils/resolveBusinessNameForContext');

describe('resolveBusinessNameForContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Tenant.findByPk.mockResolvedValue({ id: 'tenant-1', name: 'Workspace', businessType: 'shop' });
    loadTenantOrganization.mockResolvedValue({
      organization: { name: 'Kofi Prints HQ' },
      tenant: { id: 'tenant-1', name: 'Workspace' },
    });
    Setting.findOne.mockResolvedValue({ value: { name: 'Kofi Prints HQ' } });
  });

  describe('extractBranchIdsFromContext', () => {
    it('collects branch ids from nested entities', () => {
      expect(extractBranchIdsFromContext({
        invoice: { shopId: 'shop-a' },
        customer: { studioLocationId: 'studio-b' },
      })).toEqual({
        shopId: 'shop-a',
        studioLocationId: 'studio-b',
        pharmacyId: null,
      });
    });
  });

  it('uses tenant organization name for single-branch tenants', async () => {
    Shop.count.mockResolvedValue(1);

    const result = await resolveBusinessNameForContext('tenant-1', {
      shopId: 'shop-main',
      shop: { id: 'shop-main', name: 'Main Street Shop' },
    });

    expect(result).toEqual({
      businessName: 'Kofi Prints HQ',
      branchName: '',
    });
    expect(Shop.findByPk).not.toHaveBeenCalled();
  });

  it('uses specific branch name for multi-branch tenants when branch is in context', async () => {
    Shop.count.mockResolvedValue(2);
    Shop.findByPk.mockResolvedValue({ id: 'shop-b', name: 'East Legon Branch' });

    const result = await resolveBusinessNameForContext('tenant-1', {
      invoice: { shopId: 'shop-b' },
    });

    expect(result).toEqual({
      businessName: 'East Legon Branch',
      branchName: 'East Legon Branch',
    });
  });

  it('falls back to primary branch for multi-branch tenants without branch context', async () => {
    Shop.count.mockResolvedValue(3);
    Shop.findOne.mockResolvedValue({ id: 'shop-default', name: 'Head Office Shop' });

    const result = await resolveBusinessNameForContext('tenant-1', {
      customer: { id: 'cust-1', name: 'Ama' },
    });

    expect(result).toEqual({
      businessName: 'Head Office Shop',
      branchName: 'Head Office Shop',
    });
    expect(Shop.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', isDefault: true },
    }));
  });

  it('uses customer branch for birthday-style contexts in studio tenants', async () => {
    Tenant.findByPk.mockResolvedValue({ id: 'tenant-2', name: 'Studio Co', businessType: 'printing_press' });
    StudioLocation.count.mockResolvedValue(2);
    StudioLocation.findByPk.mockResolvedValue({ id: 'studio-b', name: 'Osu Studio' });

    const result = await resolveBusinessNameForContext('tenant-2', {
      customer: { studioLocationId: 'studio-b', name: 'Kojo' },
    });

    expect(result.businessName).toBe('Osu Studio');
    expect(result.branchName).toBe('Osu Studio');
  });
});
