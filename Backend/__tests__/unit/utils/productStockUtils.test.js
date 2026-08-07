const {
  sumActiveVariantQuantity,
  getEffectiveProductQuantityOnHand,
  applyEffectiveProductQuantity,
  resolveStockMovementType,
} = require('../../../utils/productStockUtils');

describe('productStockUtils', () => {
  describe('sumActiveVariantQuantity', () => {
    it('sums active variant quantities', () => {
      expect(sumActiveVariantQuantity([
        { quantityOnHand: 1, isActive: true },
        { quantityOnHand: 2, isActive: true },
        { quantityOnHand: 99, isActive: false },
      ])).toBe(3);
    });
  });

  describe('getEffectiveProductQuantityOnHand', () => {
    it('returns parent quantity for simple products', () => {
      expect(getEffectiveProductQuantityOnHand({ hasVariants: false, quantityOnHand: 5 })).toBe(5);
    });

    it('returns variant sum for variant parents', () => {
      expect(getEffectiveProductQuantityOnHand({
        hasVariants: true,
        quantityOnHand: 1,
        variants: [
          { quantityOnHand: 1, isActive: true },
          { quantityOnHand: 1, isActive: true },
        ],
      })).toBe(2);
    });

    it('uses totalVariantStock when variants are not loaded', () => {
      expect(getEffectiveProductQuantityOnHand({
        hasVariants: true,
        quantityOnHand: 1,
        totalVariantStock: 40,
      })).toBe(40);
    });
  });

  describe('applyEffectiveProductQuantity', () => {
    it('overwrites parent quantity with variant total', () => {
      const product = applyEffectiveProductQuantity({
        hasVariants: true,
        quantityOnHand: 1,
        totalVariantStock: 40,
      });
      expect(product.quantityOnHand).toBe(40);
      expect(product.totalVariantStock).toBeUndefined();
    });
  });

  describe('resolveStockMovementType', () => {
    it('uses explicit type when valid', () => {
      expect(resolveStockMovementType({ type: 'receive', reason: 'other' })).toBe('receive');
    });

    it('infers receive from reason text', () => {
      expect(resolveStockMovementType({ reason: 'Receive stock', quantityDelta: 5 })).toBe('receive');
    });

    it('defaults to adjustment', () => {
      expect(resolveStockMovementType({ reason: 'Damaged units', quantityDelta: -2 })).toBe('adjustment');
    });
  });
});
