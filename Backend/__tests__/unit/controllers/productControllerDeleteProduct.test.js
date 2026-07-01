jest.mock('../../../config/database', () => ({
  sequelize: {
    define: jest.fn(() => ({})),
    col: jest.fn((name) => ({ col: name })),
    fn: jest.fn((name, ...args) => ({ fn: name, args })),
    literal: jest.fn((value) => ({ literal: value })),
  },
}));

jest.mock('../../../controllers/expenseController', () => ({
  generateExpenseNumber: jest.fn(),
}));

jest.mock('../../../models', () => ({
  Product: {
    findOne: jest.fn(),
  },
  ProductVariant: {},
  Shop: {},
  ProductCategory: {},
  Barcode: {},
  SaleItem: {},
  Sale: {},
  Customer: {},
  User: {},
  Expense: {},
  Setting: {},
}));

jest.mock('../../../utils/tenantUtils', () => ({
  applyTenantFilter: jest.fn((_tenantId, where) => where),
  sanitizePayload: jest.fn((body) => ({ ...body })),
}));

jest.mock('../../../utils/shopUtils', () => ({
  applyShopReadFilter: jest.fn((_req, where) => where),
  attachShopToPayload: jest.fn((_req, payload) => payload),
  assertShopRecordAccess: jest.fn(),
  userCanAccessShopId: jest.fn(),
}));

jest.mock('../../../utils/paginationUtils', () => ({
  getPagination: jest.fn(),
}));

jest.mock('../../../middleware/cache', () => ({
  invalidateProductListCache: jest.fn(),
  invalidateAfterMutation: jest.fn(),
}));

const { Product } = require('../../../models');
const { assertShopRecordAccess } = require('../../../utils/shopUtils');
const { invalidateProductListCache } = require('../../../middleware/cache');
const productController = require('../../../controllers/productController');

describe('productController deleteProduct', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const productRecord = {
    id: 'product-1',
    tenantId: 'tenant-1',
    shopId: 'shop-1',
    destroy: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Product.findOne.mockResolvedValue(productRecord);
  });

  it('deletes product when tenant and shop access are valid', async () => {
    const req = { tenantId: 'tenant-1', params: { id: 'product-1' } };
    const res = mockRes();
    const next = jest.fn();

    await productController.deleteProduct(req, res, next);

    expect(assertShopRecordAccess).toHaveBeenCalledWith(req, productRecord);
    expect(productRecord.destroy).toHaveBeenCalled();
    expect(invalidateProductListCache).toHaveBeenCalledWith('tenant-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Product deleted successfully',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when shop access is denied', async () => {
    const accessErr = new Error('You do not have access to this shop');
    accessErr.statusCode = 403;
    assertShopRecordAccess.mockImplementation(() => {
      throw accessErr;
    });

    const req = { tenantId: 'tenant-1', params: { id: 'product-1' } };
    const res = mockRes();
    const next = jest.fn();

    await productController.deleteProduct(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(productRecord.destroy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when product is missing', async () => {
    Product.findOne.mockResolvedValue(null);
    const req = { tenantId: 'tenant-1', params: { id: 'missing' } };
    const res = mockRes();
    const next = jest.fn();

    await productController.deleteProduct(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });
});
