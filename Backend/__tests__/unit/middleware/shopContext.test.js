jest.mock('../../../config/businessTypes', () => ({
  resolveBusinessType: jest.fn(),
}));

jest.mock('../../../utils/shopUtils', () => ({
  hasWorkspaceWideShopAccess: jest.fn(),
  getUserShopIds: jest.fn(),
  ensureDefaultShop: jest.fn(),
}));

const { resolveBusinessType } = require('../../../config/businessTypes');
const {
  hasWorkspaceWideShopAccess,
  getUserShopIds,
  ensureDefaultShop,
} = require('../../../utils/shopUtils');
const { shopContext } = require('../../../middleware/shopContext');

const runMiddleware = (req) =>
  new Promise((resolve, reject) => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((body) => resolve({ status: res.status.mock.calls[0]?.[0], body })),
    };
    shopContext(req, res, (err) => (err ? reject(err) : resolve({ next: true, req })));
  });

describe('shopContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveBusinessType.mockReturnValue('shop');
    hasWorkspaceWideShopAccess.mockReturnValue(true);
    getUserShopIds.mockResolvedValue(['shop-valid']);
    ensureDefaultShop.mockResolvedValue({ id: 'shop-default' });
  });

  it('ignores stale x-shop-id for workspace-wide users', async () => {
    const req = {
      tenant: { businessType: 'shop', name: 'Shop' },
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
      tenantRole: 'admin',
      headers: { 'x-shop-id': 'shop-deleted' },
    };

    await runMiddleware(req);

    expect(req.shopFilterId).toBe('shop-default');
  });

  it('sets shopFilterId when header matches an allowed shop', async () => {
    const req = {
      tenant: { businessType: 'shop', name: 'Shop' },
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
      tenantRole: 'admin',
      headers: { 'x-shop-id': 'shop-valid' },
    };

    await runMiddleware(req);

    expect(req.shopFilterId).toBe('shop-valid');
  });

  it('activates shop scope for pharmacy tenants', async () => {
    resolveBusinessType.mockReturnValue('pharmacy');

    const req = {
      tenant: { businessType: 'pharmacy', name: 'Pharmacy' },
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
      tenantRole: 'admin',
      headers: { 'x-shop-id': 'shop-valid' },
    };

    await runMiddleware(req);

    expect(req.shopScoped).toBe(true);
    expect(req.shopFilterId).toBe('shop-valid');
  });
});
