jest.mock('../../../config/database', () => ({
  sequelize: {
    define: jest.fn(() => ({})),
    col: jest.fn((name) => ({ col: name })),
    fn: jest.fn((name, ...args) => ({ fn: name, args })),
    literal: jest.fn((value) => ({ literal: value })),
    cast: jest.fn((value, type) => ({ cast: value, type })),
    where: jest.fn((attr, condition) => ({ where: attr, condition })),
  },
}));

jest.mock('../../../controllers/expenseController', () => ({
  generateExpenseNumber: jest.fn(),
}));

jest.mock('../../../models', () => ({
  Product: {
    findAndCountAll: jest.fn(),
    sequelize: {
      literal: jest.fn((value) => ({ literal: value })),
      cast: jest.fn((value, type) => ({ cast: value, type })),
      where: jest.fn((attr, condition) => ({ where: attr, condition })),
    },
  },
  ProductVariant: {},
  Shop: {},
  ProductCategory: {},
  Barcode: {
    findAll: jest.fn().mockResolvedValue([]),
  },
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

jest.mock('../../../utils/productStockUtils', () => ({
  applyEffectiveProductQuantity: jest.fn((product) => product),
  syncParentQuantityFromVariants: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/paginationUtils', () => ({
  getPagination: jest.fn(() => ({ page: 1, limit: 10, offset: 0 })),
}));

jest.mock('../../../middleware/cache', () => ({
  invalidateProductListCache: jest.fn(),
  invalidateAfterMutation: jest.fn(),
}));

const { Product } = require('../../../models');
const productController = require('../../../controllers/productController');

describe('productController list sort', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Product.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
  });

  describe('_resolveProductListSort', () => {
    it('defaults to name_asc with id tie-breaker', () => {
      expect(productController._resolveProductListSort()).toEqual({
        sort: 'name_asc',
        order: [['name', 'ASC'], ['id', 'ASC']],
      });
    });

    it('falls back to name_asc for unknown values', () => {
      expect(productController._resolveProductListSort('size_asc').sort).toBe('name_asc');
      expect(productController._resolveProductListSort('').sort).toBe('name_asc');
    });

    it('resolves each whitelist key', () => {
      expect(productController._resolveProductListSort('created_desc').order).toEqual([
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ]);
      expect(productController._resolveProductListSort('updated_desc').order).toEqual([
        ['updatedAt', 'DESC'],
        ['id', 'DESC'],
      ]);
      expect(productController._resolveProductListSort('stock_desc').order).toEqual([
        ['quantityOnHand', 'DESC'],
        ['id', 'DESC'],
      ]);
      expect(productController._resolveProductListSort('stock_asc').order).toEqual([
        ['quantityOnHand', 'ASC'],
        ['id', 'ASC'],
      ]);
      expect(productController._resolveProductListSort('price_asc').order).toEqual([
        ['sellingPrice', 'ASC'],
        ['id', 'ASC'],
      ]);
      expect(productController._resolveProductListSort('price_desc').order).toEqual([
        ['sellingPrice', 'DESC'],
        ['id', 'DESC'],
      ]);
    });
  });

  describe('getProducts', () => {
    it('passes resolved order from sort query (default name_asc)', async () => {
      const req = { tenantId: 't1', query: {}, shopScoped: false };
      const res = mockRes();

      await productController.getProducts(req, res, jest.fn());

      expect(Product.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['name', 'ASC'], ['id', 'ASC']],
        }),
      );
    });

    it('accepts sortBy alias and whitelist values', async () => {
      const req = { tenantId: 't1', query: { sortBy: 'price_desc' }, shopScoped: false };
      const res = mockRes();

      await productController.getProducts(req, res, jest.fn());

      expect(Product.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['sellingPrice', 'DESC'], ['id', 'DESC']],
        }),
      );
    });

    it('rejects unknown sort and uses name_asc', async () => {
      const req = { tenantId: 't1', query: { sort: 'not_a_real_sort' }, shopScoped: false };
      const res = mockRes();

      await productController.getProducts(req, res, jest.fn());

      expect(Product.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['name', 'ASC'], ['id', 'ASC']],
        }),
      );
    });
  });
});
