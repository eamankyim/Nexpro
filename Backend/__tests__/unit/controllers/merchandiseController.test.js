jest.mock('../../../models', () => ({
  Product: { findAll: jest.fn() },
  ProductVariant: {},
  ProductCategory: {},
  Drug: { findAll: jest.fn() },
  MaterialCategory: {},
}));

jest.mock('../../../utils/tenantUtils', () => ({
  applyTenantFilter: jest.fn((_tenantId, where) => where),
}));

jest.mock('../../../utils/shopUtils', () => ({
  applyShopReadFilter: jest.fn((_req, where) => where),
}));

const { Product, Drug } = require('../../../models');
const merchandiseController = require('../../../controllers/merchandiseController');

describe('merchandiseController getMerchandiseSummary', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const asProductRecord = (data) => ({
    get: () => data,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates simple (non-variant) products for shop tenants', async () => {
    Product.findAll.mockResolvedValue([
      asProductRecord({
        id: 'p1',
        name: 'Rice 5kg',
        sku: 'RICE-5',
        quantityOnHand: '10',
        costPrice: '20',
        sellingPrice: '30',
        hasVariants: false,
        category: { name: 'Groceries' },
      }),
    ]);

    const req = { tenantId: 'tenant-1', tenantRole: 'manager', tenant: { businessType: 'shop' }, shopScoped: false };
    const res = mockRes();
    const next = jest.fn();

    await merchandiseController.getMerchandiseSummary(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.businessType).toBe('shop');
    expect(payload.data.source).toBe('products');
    expect(payload.data.items).toEqual([
      expect.objectContaining({
        id: 'p1',
        name: 'Rice 5kg',
        category: 'Groceries',
        quantityOnHand: 10,
        costValue: 200,
        sellingValue: 300,
      }),
    ]);
    expect(payload.data.totals).toEqual({
      totalItems: 1,
      totalQuantity: 10,
      totalCostValue: 200,
      totalSellingValue: 300,
    });
  });

  it('sums variant quantity and value, falling back to parent price when variant price is null', async () => {
    Product.findAll.mockResolvedValue([
      asProductRecord({
        id: 'p2',
        name: 'T-Shirt',
        sku: 'TSHIRT',
        quantityOnHand: '0',
        costPrice: '15',
        sellingPrice: '25',
        hasVariants: true,
        category: null,
        variants: [
          { id: 'v1', quantityOnHand: '5', costPrice: null, sellingPrice: null },
          { id: 'v2', quantityOnHand: '3', costPrice: '18', sellingPrice: '28' },
        ],
      }),
    ]);

    const req = { tenantId: 'tenant-1', tenantRole: 'admin', tenant: { businessType: 'shop' }, shopScoped: false };
    const res = mockRes();
    const next = jest.fn();

    await merchandiseController.getMerchandiseSummary(req, res, next);

    const payload = res.json.mock.calls[0][0];
    // v1: 5 * 15 = 75 cost, 5 * 25 = 125 selling (inherits parent price)
    // v2: 3 * 18 = 54 cost, 3 * 28 = 84 selling (own price)
    expect(payload.data.items[0]).toEqual(
      expect.objectContaining({
        id: 'p2',
        quantityOnHand: 8,
        costValue: 129,
        sellingValue: 209,
      })
    );
  });

  it('uses the Drug catalog for pharmacy tenants', async () => {
    Drug.findAll.mockResolvedValue([
      asProductRecord({
        id: 'd1',
        name: 'Paracetamol',
        sku: 'PARA-500',
        quantityOnHand: '100',
        costPrice: '0.5',
        sellingPrice: '1.2',
        category: { name: 'Painkillers' },
      }),
    ]);

    const req = { tenantId: 'tenant-2', tenantRole: 'manager', tenant: { businessType: 'pharmacy' } };
    const res = mockRes();
    const next = jest.fn();

    await merchandiseController.getMerchandiseSummary(req, res, next);

    expect(Product.findAll).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.businessType).toBe('pharmacy');
    expect(payload.data.source).toBe('drugs');
    expect(payload.data.items).toEqual([
      expect.objectContaining({ id: 'd1', name: 'Paracetamol', quantityOnHand: 100, costValue: 50, sellingValue: 120 }),
    ]);
  });

  it('returns an empty, unsupported result for studio tenants', async () => {
    const req = { tenantId: 'tenant-3', tenantRole: 'manager', tenant: { businessType: 'studio' } };
    const res = mockRes();
    const next = jest.fn();

    await merchandiseController.getMerchandiseSummary(req, res, next);

    expect(Product.findAll).not.toHaveBeenCalled();
    expect(Drug.findAll).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.supported).toBe(false);
    expect(payload.data.items).toEqual([]);
    expect(payload.data.totals).toEqual({
      totalItems: 0,
      totalQuantity: 0,
      totalCostValue: 0,
      totalSellingValue: 0,
    });
  });

  it('forwards errors to next()', async () => {
    const boom = new Error('db down');
    Product.findAll.mockRejectedValue(boom);

    const req = { tenantId: 'tenant-1', tenant: { businessType: 'shop' } };
    const res = mockRes();
    const next = jest.fn();

    await merchandiseController.getMerchandiseSummary(req, res, next);

    expect(next).toHaveBeenCalledWith(boom);
    expect(res.status).not.toHaveBeenCalled();
  });
});
