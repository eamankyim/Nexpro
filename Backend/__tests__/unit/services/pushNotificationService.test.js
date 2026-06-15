const mockUserScope = {
  findAll: jest.fn(),
  findByPk: jest.fn(),
};
const mockStorefrontCustomer = {
  findAll: jest.fn(),
  findByPk: jest.fn(),
};

jest.mock('axios', () => ({
  post: jest.fn(),
}));

jest.mock('../../../models', () => ({
  StorefrontCustomer: mockStorefrontCustomer,
  User: {
    scope: jest.fn(() => mockUserScope),
  },
}));

const axios = require('axios');
const {
  dispatchExpoPushToStorefrontCustomers,
  dispatchExpoPushToUsers,
  getPushTargetsForStorefrontCustomers,
  getPushTargetsForUsers,
  isExpoPushToken,
} = require('../../../services/pushNotificationService');

describe('pushNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates Expo push token formats', () => {
    expect(isExpoPushToken('ExpoPushToken[token-a]')).toBe(true);
    expect(isExpoPushToken('ExponentPushToken[token-a]')).toBe(true);
    expect(isExpoPushToken('web-push-token')).toBe(false);
  });

  it('filters targets by tenant, token validity, duplicates, and push preferences', async () => {
    mockUserScope.findAll.mockResolvedValue([
      {
        id: 'user-1',
        notificationPreferences: {
          categories: { order: { in_app: true, email: false, push: true } },
          pushDevices: [
            { token: 'ExpoPushToken[token-a]', tenantId: 'tenant-1' },
            { token: 'ExpoPushToken[token-a]', tenantId: 'tenant-1' },
            { token: 'bad-token', tenantId: 'tenant-1' },
          ],
        },
      },
      {
        id: 'user-2',
        notificationPreferences: {
          categories: { order: { in_app: true, email: false, push: false } },
          pushDevices: [{ token: 'ExpoPushToken[token-b]', tenantId: 'tenant-1' }],
        },
      },
      {
        id: 'user-3',
        notificationPreferences: {
          pushDevices: [{ token: 'ExpoPushToken[token-c]', tenantId: 'tenant-2' }],
        },
      },
    ]);

    await expect(getPushTargetsForUsers({
      userIds: ['user-1', 'user-2', 'user-3'],
      tenantId: 'tenant-1',
      category: 'order',
    })).resolves.toEqual([
      { userId: 'user-1', token: 'ExpoPushToken[token-a]' },
    ]);
  });

  it('uses alert preferences for inventory stock alert pushes', async () => {
    mockUserScope.findAll.mockResolvedValue([
      {
        id: 'user-1',
        notificationPreferences: {
          categories: { alert: { in_app: true, email: false, push: false } },
          pushDevices: [{ token: 'ExpoPushToken[token-a]', tenantId: 'tenant-1' }],
        },
      },
    ]);

    await expect(getPushTargetsForUsers({
      userIds: ['user-1'],
      tenantId: 'tenant-1',
      category: 'inventory',
    })).resolves.toEqual([]);
  });

  it('removes Expo tokens reported as DeviceNotRegistered', async () => {
    const update = jest.fn();
    mockUserScope.findAll.mockResolvedValue([
      {
        id: 'user-1',
        notificationPreferences: {
          pushDevices: [
            { token: 'ExpoPushToken[expired]', tenantId: 'tenant-1' },
            { token: 'ExpoPushToken[active]', tenantId: 'tenant-1' },
          ],
        },
      },
    ]);
    mockUserScope.findByPk.mockResolvedValue({
      id: 'user-1',
      notificationPreferences: {
        pushDevices: [
          { token: 'ExpoPushToken[expired]', tenantId: 'tenant-1' },
          { token: 'ExpoPushToken[active]', tenantId: 'tenant-1' },
        ],
      },
      update,
    });
    axios.post.mockResolvedValue({
      data: {
        data: [
          { status: 'error', details: { error: 'DeviceNotRegistered' } },
          { status: 'ok' },
        ],
      },
    });

    const result = await dispatchExpoPushToUsers({
      tenantId: 'tenant-1',
      userIds: ['user-1'],
      title: 'New Online Store Order',
      message: 'A shopper placed an order.',
      type: 'order',
      priority: 'high',
      metadata: { saleId: 'sale-1' },
      link: '/store/orders',
    });

    expect(result).toEqual({ sent: 1, attempted: 2, invalidTokens: 1 });
    expect(axios.post).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.arrayContaining([
        expect.objectContaining({
          to: 'ExpoPushToken[expired]',
          title: 'New Online Store Order',
          priority: 'high',
        }),
        expect.objectContaining({
          to: 'ExpoPushToken[active]',
        }),
      ]),
      expect.objectContaining({ timeout: 10000 })
    );
    expect(update).toHaveBeenCalledWith({
      notificationPreferences: {
        pushDevices: [{ token: 'ExpoPushToken[active]', tenantId: 'tenant-1' }],
      },
    });
  });

  it('filters storefront customer targets by Expo token validity, duplicates, and order update preferences', async () => {
    mockStorefrontCustomer.findAll.mockResolvedValue([
      {
        id: 'buyer-1',
        metadata: {
          notificationPreferences: { orderUpdates: true },
          pushDevices: [
            { token: 'ExpoPushToken[buyer-a]', platform: 'ios' },
            { token: 'ExpoPushToken[buyer-a]', platform: 'ios' },
            { token: 'web-push-token', platform: 'android' },
          ],
        },
      },
      {
        id: 'buyer-2',
        metadata: {
          notificationPreferences: { orderUpdates: false },
          pushDevices: [{ token: 'ExpoPushToken[buyer-b]', platform: 'android' }],
        },
      },
      {
        id: 'buyer-3',
        metadata: {
          pushDevices: [{ token: 'ExpoPushToken[buyer-c]', platform: 'ios' }],
        },
      },
    ]);

    await expect(getPushTargetsForStorefrontCustomers({
      storefrontCustomerIds: ['buyer-1', 'buyer-2', 'buyer-3'],
    })).resolves.toEqual([
      { ownerId: 'buyer-1', token: 'ExpoPushToken[buyer-a]' },
      { ownerId: 'buyer-3', token: 'ExpoPushToken[buyer-c]' },
    ]);
  });

  it('dispatches buyer order status pushes and removes invalid storefront customer tokens', async () => {
    const update = jest.fn();
    mockStorefrontCustomer.findAll.mockResolvedValue([
      {
        id: 'buyer-1',
        metadata: {
          notificationPreferences: { orderUpdates: true },
          pushDevices: [
            { token: 'ExpoPushToken[expired-buyer]', platform: 'ios' },
            { token: 'ExpoPushToken[active-buyer]', platform: 'android' },
          ],
        },
      },
    ]);
    mockStorefrontCustomer.findByPk.mockResolvedValue({
      id: 'buyer-1',
      metadata: {
        notificationPreferences: { orderUpdates: true },
        pushDevices: [
          { token: 'ExpoPushToken[expired-buyer]', platform: 'ios' },
          { token: 'ExpoPushToken[active-buyer]', platform: 'android' },
        ],
      },
      update,
    });
    axios.post.mockResolvedValue({
      data: {
        data: [
          { status: 'error', details: { error: 'DeviceNotRegistered' } },
          { status: 'ok' },
        ],
      },
    });

    const result = await dispatchExpoPushToStorefrontCustomers({
      tenantId: 'tenant-1',
      storefrontCustomerIds: ['buyer-1'],
      title: 'Order on the way',
      message: 'Your order is out for delivery. SALE-1',
      type: 'order_update',
      priority: 'normal',
      metadata: { saleId: 'sale-1', action: 'out_for_delivery' },
      link: '/order/sale-1',
    });

    expect(result).toEqual({ sent: 1, attempted: 2, invalidTokens: 1 });
    expect(axios.post).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.arrayContaining([
        expect.objectContaining({
          to: 'ExpoPushToken[expired-buyer]',
          title: 'Order on the way',
          data: expect.objectContaining({
            type: 'order_update',
            tenantId: 'tenant-1',
            link: '/order/sale-1',
            metadata: expect.objectContaining({ action: 'out_for_delivery' }),
          }),
        }),
      ]),
      expect.objectContaining({ timeout: 10000 })
    );
    expect(update).toHaveBeenCalledWith({
      metadata: {
        notificationPreferences: { orderUpdates: true },
        pushDevices: [{ token: 'ExpoPushToken[active-buyer]', platform: 'android' }],
      },
    });
  });
});
