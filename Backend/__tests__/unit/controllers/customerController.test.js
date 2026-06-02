jest.mock('../../../config/database', () => ({
  sequelize: {},
}));

jest.mock('../../../models', () => ({
  Customer: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
  Job: {},
  CustomerActivity: {},
  User: {},
}));

jest.mock('../../../utils/tenantUtils', () => ({
  applyTenantFilter: jest.fn((_tenantId, where) => where),
  sanitizePayload: jest.fn((body) => ({ ...body })),
}));

jest.mock('../../../utils/studioLocationUtils', () => ({
  applyStudioLocationFilter: jest.fn((_req, where) => where),
}));

jest.mock('../../../utils/shopUtils', () => ({
  applyShopReadFilter: jest.fn((_req, where) => where),
  attachScopedToPayload: jest.fn((_req, payload) => ({
    ...payload,
    studioLocationId: _req.studioLocationFilterId || null,
    shopId: _req.shopFilterId || null,
  })),
  assertShopRecordAccess: jest.fn(),
  getShopReadSqlFragment: jest.fn(() => ({ sql: '', replacements: {} })),
}));

jest.mock('../../../utils/paginationUtils', () => ({
  getPagination: jest.fn(),
}));

jest.mock('../../../middleware/cache', () => ({
  invalidateCustomerListCache: jest.fn(),
}));

jest.mock('../../../utils/customerUniquenessUtils', () => ({
  assertCustomerContactUnique: jest.fn(),
}));

const { Customer } = require('../../../models');
const { assertCustomerContactUnique } = require('../../../utils/customerUniquenessUtils');
const { attachScopedToPayload } = require('../../../utils/shopUtils');
const customerController = require('../../../controllers/customerController');

describe('customerController createCustomer', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    assertCustomerContactUnique.mockResolvedValue(undefined);
    Customer.create.mockResolvedValue({ id: 'cust-1', name: 'Jane', phone: '+233244123456' });
  });

  it('creates customer in studio B when same phone exists in studio A', async () => {
    const req = {
      tenantId: 'tenant-1',
      studioLocationScoped: true,
      studioLocationFilterId: 'studio-b',
      body: { name: 'Jane', phone: '0244123456' },
    };
    const res = mockRes();
    const next = jest.fn();

    await customerController.createCustomer(req, res, next);

    expect(assertCustomerContactUnique).toHaveBeenCalledWith(req, {
      phone: '0244123456',
      email: undefined,
    });
    expect(attachScopedToPayload).toHaveBeenCalled();
    expect(Customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        phone: '0244123456',
        studioLocationId: 'studio-b',
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards duplicate phone errors from uniqueness check', async () => {
    const dupErr = new Error('Phone number already exists');
    dupErr.statusCode = 400;
    assertCustomerContactUnique.mockRejectedValue(dupErr);

    const req = {
      tenantId: 'tenant-1',
      studioLocationScoped: true,
      studioLocationFilterId: 'studio-a',
      body: { name: 'Jane', phone: '0244123456' },
    };
    const res = mockRes();
    const next = jest.fn();

    await customerController.createCustomer(req, res, next);

    expect(Customer.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(dupErr);
  });
});
