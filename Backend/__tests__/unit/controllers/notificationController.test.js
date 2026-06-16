jest.mock('../../../config/database', () => ({
  sequelize: {
    where: jest.fn((...args) => ({ whereArgs: args })),
    col: jest.fn((name) => ({ col: name })),
    query: jest.fn(),
    QueryTypes: { SELECT: 'SELECT' },
  },
}));

jest.mock('../../../config/config', () => ({
  nodeEnv: 'test',
}));

jest.mock('../../../models', () => ({
  Notification: {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  User: {},
  Product: {
    count: jest.fn(),
    findOne: jest.fn(),
  },
  Tenant: {
    findByPk: jest.fn(),
  },
}));

jest.mock('../../../utils/tenantUtils', () => ({
  applyTenantFilter: jest.fn((tenantId, where = {}) => ({ ...where, tenantId })),
}));

jest.mock('../../../utils/shopUtils', () => ({
  applyShopFilter: jest.fn((req, where = {}) => (
    req.shopFilterId ? { ...where, shopId: req.shopFilterId } : where
  )),
}));

jest.mock('../../../utils/paginationUtils', () => ({
  getPagination: jest.fn(() => ({ page: 1, limit: 20, offset: 0 })),
}));

jest.mock('../../../middleware/cache', () => ({
  invalidateNotificationsCache: jest.fn(),
}));

jest.mock('../../../utils/performanceLogger', () => ({
  startHotPathTimer: jest.fn(() => jest.fn()),
}));

jest.mock('../../../services/pushNotificationService', () => ({
  dispatchExpoPushToUsers: jest.fn().mockResolvedValue({
    sent: 1,
    attempted: 1,
    invalidTokens: 0,
  }),
}));

const { Notification, Product } = require('../../../models');
const { getNotifications } = require('../../../controllers/notificationController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('notificationController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notification.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    Notification.findOne.mockResolvedValue(null);
    Notification.create.mockResolvedValue({ id: 'notification-1' });
    Product.count.mockResolvedValue(0);
    Product.findOne.mockResolvedValue(null);
  });

  it('includes deep-link metadata in notification list responses', async () => {
    Notification.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [
        {
          id: 'notification-1',
          type: 'job',
          link: '/jobs/job-1',
          metadata: { jobId: 'job-1' },
        },
      ],
    });

    const req = {
      tenantId: 'tenant-1',
      tenant: { businessType: 'service' },
      user: { id: 'user-1' },
      query: {},
    };
    const res = makeRes();
    const next = jest.fn();

    await getNotifications(req, res, next);

    expect(Notification.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      attributes: expect.arrayContaining(['metadata', 'link', 'type', 'triggeredBy']),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ metadata: { jobId: 'job-1' } }),
      ]),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('stores productId in one-product stock alert metadata', async () => {
    Product.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    Product.findOne.mockResolvedValueOnce({ id: 'product-1' });

    const req = {
      tenantId: 'tenant-1',
      tenant: { businessType: 'shop' },
      user: { id: 'user-1' },
      query: {},
      shopFilterId: 'shop-1',
    };
    const res = makeRes();
    const next = jest.fn();

    await getNotifications(req, res, next);

    expect(Product.findOne).toHaveBeenCalledWith(expect.objectContaining({
      attributes: ['id'],
    }));
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'inventory',
      metadata: expect.objectContaining({
        source: 'stock_alert',
        alertType: 'out_of_stock',
        count: 1,
        shopId: 'shop-1',
        productId: 'product-1',
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
