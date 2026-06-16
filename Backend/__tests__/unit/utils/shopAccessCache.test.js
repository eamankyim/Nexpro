jest.mock('../../../config/businessTypes', () => ({
  resolveBusinessType: jest.fn((value) => value || 'shop'),
}));

jest.mock('../../../models', () => ({
  Shop: {
    findAll: jest.fn(),
  },
  Tenant: {},
  Setting: {},
  UserShop: {
    findAll: jest.fn(),
  },
}));

const { Shop, UserShop } = require('../../../models');
const {
  getUserShopIds,
  invalidateShopAccessCache,
} = require('../../../utils/shopUtils');

describe('shop access cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateShopAccessCache('tenant-1');
  });

  it('caches workspace-wide shop ids briefly and invalidates by tenant', async () => {
    Shop.findAll.mockResolvedValueOnce([{ id: 'shop-1' }]);

    await expect(getUserShopIds('user-1', 'tenant-1', 'admin')).resolves.toEqual(['shop-1']);
    await expect(getUserShopIds('user-1', 'tenant-1', 'admin')).resolves.toEqual(['shop-1']);

    expect(Shop.findAll).toHaveBeenCalledTimes(1);

    invalidateShopAccessCache('tenant-1');
    Shop.findAll.mockResolvedValueOnce([{ id: 'shop-2' }]);

    await expect(getUserShopIds('user-1', 'tenant-1', 'admin')).resolves.toEqual(['shop-2']);
    expect(Shop.findAll).toHaveBeenCalledTimes(2);
  });

  it('caches assigned shop ids per user', async () => {
    UserShop.findAll.mockResolvedValueOnce([{ shopId: 'shop-assigned' }]);
    Shop.findAll.mockResolvedValueOnce([{ id: 'shop-assigned' }]);

    await expect(getUserShopIds('user-2', 'tenant-1', 'staff')).resolves.toEqual(['shop-assigned']);
    await expect(getUserShopIds('user-2', 'tenant-1', 'staff')).resolves.toEqual(['shop-assigned']);

    expect(UserShop.findAll).toHaveBeenCalledTimes(1);
    expect(Shop.findAll).toHaveBeenCalledTimes(1);
  });
});
