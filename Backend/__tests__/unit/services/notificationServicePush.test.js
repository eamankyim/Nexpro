jest.mock('../../../config/database', () => ({
  sequelize: {
    where: jest.fn((...args) => ({ whereArgs: args })),
    literal: jest.fn((value) => value),
  },
}));

jest.mock('../../../services/websocketService', () => ({
  emitNotification: jest.fn(),
}));

jest.mock('../../../services/pushNotificationService', () => ({
  dispatchExpoPushToUsers: jest.fn().mockResolvedValue({
    sent: 1,
    attempted: 1,
    invalidTokens: 0,
  }),
}));

jest.mock('../../../models', () => ({
  Notification: {
    count: jest.fn(),
    bulkCreate: jest.fn(),
  },
  User: {
    findAll: jest.fn(),
  },
  UserTenant: {
    findAll: jest.fn(),
  },
}));

const { Notification, User, UserTenant } = require('../../../models');
const { dispatchExpoPushToUsers } = require('../../../services/pushNotificationService');
const { notifyOnlineStoreOrderReceived } = require('../../../services/notificationService');

describe('notificationService push wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notification.count.mockResolvedValue(0);
    Notification.bulkCreate.mockImplementation(async (rows) =>
      rows.map((row, index) => ({
        ...row,
        id: `notification-${index + 1}`,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      }))
    );
    User.findAll.mockResolvedValue([
      {
        id: 'user-1',
        notificationPreferences: {
          categories: { order: { in_app: true, email: false, push: true } },
        },
      },
    ]);
    UserTenant.findAll.mockResolvedValue([{ userId: 'user-1' }]);
  });

  it('marks online store seller notifications for push dispatch', async () => {
    await notifyOnlineStoreOrderReceived({
      sale: {
        id: 'sale-1',
        tenantId: 'tenant-1',
        saleNumber: 'SO-1001',
        shopId: 'shop-1',
      },
      shopper: { id: 'shopper-1', name: 'Akua' },
      store: { displayName: 'Sulas Store' },
    });

    expect(Notification.bulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          title: 'New Online Store Order',
          type: 'order',
          priority: 'high',
          channels: ['in_app', 'push'],
          metadata: expect.objectContaining({
            saleId: 'sale-1',
            source: 'online_store',
          }),
          link: '/store/orders',
        }),
      ],
      { transaction: null }
    );
    expect(dispatchExpoPushToUsers).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userIds: ['user-1'],
      title: 'New Online Store Order',
      type: 'order',
      priority: 'high',
      link: '/store/orders',
    }));
  });
});
