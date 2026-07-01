jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { api } from '@/services/api';
import { productService } from '@/services/productService';

describe('productService.adjustStock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('adds received stock to the current product quantity', async () => {
    jest.mocked(api.get).mockResolvedValue({
      data: {
        id: 'product-1',
        quantityOnHand: 4,
        metadata: { existing: true },
      },
    });
    jest.mocked(api.put).mockResolvedValue({ data: { success: true } });

    await productService.adjustStock('product-1', 6, 'delta', 'Receive stock');

    expect(api.get).toHaveBeenCalledWith('/products/product-1');
    expect(api.put).toHaveBeenCalledWith('/products/product-1', {
      quantityOnHand: 10,
      metadata: {
        existing: true,
        lastStockAdjustment: {
          previousQuantity: 4,
          newQuantity: 10,
          mode: 'delta',
          reason: 'Receive stock',
          timestamp: '2026-06-15T10:00:00.000Z',
        },
      },
    });
  });
});

describe('productService.deleteProductVariant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls DELETE /products/variants/:variantId', async () => {
    jest.mocked(api.delete).mockResolvedValue({
      data: { success: true, message: 'Variant deleted successfully' },
    });

    const result = await productService.deleteProductVariant('variant-1');

    expect(api.delete).toHaveBeenCalledWith('/products/variants/variant-1');
    expect(result).toEqual({ success: true, message: 'Variant deleted successfully' });
  });
});
