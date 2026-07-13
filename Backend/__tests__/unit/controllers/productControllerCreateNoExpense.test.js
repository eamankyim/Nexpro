jest.mock('../../../config/database', () => ({
  sequelize: {
    define: jest.fn(() => ({})),
    col: jest.fn((name) => ({ col: name })),
    fn: jest.fn((name, ...args) => ({ fn: name, args })),
    literal: jest.fn((value) => ({ literal: value })),
  },
}));

const mockTransaction = {
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../../models', () => ({
  Product: {
    create: jest.fn(),
    sequelize: {
      transaction: jest.fn(),
    },
  },
  ProductVariant: {},
  Shop: {},
  ProductCategory: {},
  Barcode: {},
  SaleItem: {},
  Sale: {},
  Customer: {},
  User: {},
  Expense: {
    create: jest.fn(),
  },
  Setting: {
    findOne: jest.fn(),
  },
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

jest.mock('../../../config/expenseCategories', () => ({
  getExpenseCategories: jest.fn(() => ['Inventory', 'Rent', 'Other']),
}));

jest.mock('../../../controllers/expenseController', () => ({
  generateExpenseNumber: jest.fn().mockResolvedValue('EXP-001'),
}));

const { Product, Expense, Setting } = require('../../../models');
const { invalidateProductListCache, invalidateAfterMutation } = require('../../../middleware/cache');
const { generateExpenseNumber } = require('../../../controllers/expenseController');
const productController = require('../../../controllers/productController');

describe('productController createProduct — no inventory expense', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const createdProduct = {
    id: 'product-1',
    name: 'Widget',
    costPrice: 10,
    quantityOnHand: 5,
    tenantId: 'tenant-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Product.sequelize.transaction.mockResolvedValue(mockTransaction);
    Product.create.mockResolvedValue(createdProduct);
    Setting.findOne.mockResolvedValue({
      value: { autoCreateExpenseFromProductCost: true },
    });
  });

  it('creates a product without creating an Expense even if legacy auto-expense setting is true', async () => {
    const req = {
      tenantId: 'tenant-1',
      tenant: { businessType: 'shop', metadata: {} },
      user: { id: 'user-1' },
      body: {
        name: 'Widget',
        costPrice: 10,
        quantityOnHand: 5,
        sellingPrice: 20,
      },
    };
    const res = mockRes();
    const next = jest.fn();

    await productController.createProduct(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Product.create).toHaveBeenCalled();
    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(invalidateProductListCache).toHaveBeenCalledWith('tenant-1');
    expect(Expense.create).not.toHaveBeenCalled();
    expect(Setting.findOne).not.toHaveBeenCalled();
    expect(generateExpenseNumber).not.toHaveBeenCalled();
    expect(invalidateAfterMutation).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: createdProduct,
    });
  });
});
