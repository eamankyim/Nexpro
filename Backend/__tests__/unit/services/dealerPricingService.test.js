jest.mock('../../../models', () => ({
  Product: {
    findOne: jest.fn(),
  },
  ProductVariant: {
    findOne: jest.fn(),
  },
  DealerProductPrice: {
    findOne: jest.fn(),
  },
}));

const { Product, ProductVariant, DealerProductPrice } = require('../../../models');
const { resolvePrice } = require('../../../services/dealerPricingService');

describe('dealerPricingService.resolvePrice', () => {
  const base = {
    tenantId: 'tenant-1',
    shopId: 'shop-1',
    dealerId: 'dealer-1',
    productId: 'product-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns dealer override first', async () => {
    DealerProductPrice.findOne.mockResolvedValueOnce({ unitPrice: '80.00' });

    const result = await resolvePrice(base);

    expect(result).toEqual({
      unitPrice: 80,
      source: 'dealer',
      retailPrice: null,
    });
    expect(Product.findOne).not.toHaveBeenCalled();
  });

  it('returns tier when no dealer override', async () => {
    DealerProductPrice.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ unitPrice: '90.50' });

    const result = await resolvePrice({ ...base, priceTierId: 'tier-1' });

    expect(result).toEqual({
      unitPrice: 90.5,
      source: 'tier',
      retailPrice: null,
    });
  });

  it('returns product wholesale before retail', async () => {
    DealerProductPrice.findOne.mockResolvedValue(null);
    Product.findOne.mockResolvedValue({
      wholesalePrice: '70.00',
      sellingPrice: '100.00',
    });

    const result = await resolvePrice(base);

    expect(result).toEqual({
      unitPrice: 70,
      source: 'wholesale',
      retailPrice: 100,
    });
  });

  it('returns variant wholesale over product wholesale', async () => {
    DealerProductPrice.findOne.mockResolvedValue(null);
    ProductVariant.findOne.mockResolvedValue({
      wholesalePrice: '65.00',
      sellingPrice: '95.00',
    });
    Product.findOne.mockResolvedValue({
      wholesalePrice: '70.00',
      sellingPrice: '100.00',
    });

    const result = await resolvePrice({
      ...base,
      productVariantId: 'variant-1',
    });

    expect(result).toEqual({
      unitPrice: 65,
      source: 'wholesale',
      retailPrice: 95,
    });
  });

  it('inherits product wholesale when variant wholesale is null', async () => {
    DealerProductPrice.findOne.mockResolvedValue(null);
    ProductVariant.findOne.mockResolvedValue({
      wholesalePrice: null,
      sellingPrice: '95.00',
    });
    Product.findOne.mockResolvedValue({
      wholesalePrice: '70.00',
      sellingPrice: '100.00',
    });

    const result = await resolvePrice({
      ...base,
      productVariantId: 'variant-1',
    });

    expect(result).toEqual({
      unitPrice: 70,
      source: 'wholesale',
      retailPrice: 95,
    });
  });

  it('falls back to retail sellingPrice when no wholesale', async () => {
    DealerProductPrice.findOne.mockResolvedValue(null);
    Product.findOne.mockResolvedValue({
      wholesalePrice: null,
      sellingPrice: '120.00',
    });

    const result = await resolvePrice(base);

    expect(result).toEqual({
      unitPrice: 120,
      source: 'retail',
      retailPrice: 120,
    });
  });

  it('cascade order: dealer beats wholesale', async () => {
    DealerProductPrice.findOne.mockResolvedValueOnce({ unitPrice: '50.00' });
    Product.findOne.mockResolvedValue({
      wholesalePrice: '70.00',
      sellingPrice: '100.00',
    });

    const result = await resolvePrice(base);

    expect(result.source).toBe('dealer');
    expect(result.unitPrice).toBe(50);
    expect(Product.findOne).not.toHaveBeenCalled();
  });
});
