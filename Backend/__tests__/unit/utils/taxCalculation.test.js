const {
  convertLineItemsFromTaxInclusive,
  computeTotalsFromSubtotalAndDiscount
} = require('../../../utils/taxCalculation');

describe('taxCalculation inclusive invoice conversion', () => {
  it('converts tax-inclusive line prices to net values while preserving gross total', () => {
    const converted = convertLineItemsFromTaxInclusive([
      {
        description: 'Item',
        quantity: 1,
        unitPrice: 112,
        total: 112
      }
    ], 12);

    expect(converted).toEqual({
      items: [expect.objectContaining({
        unitPrice: 100,
        discountAmount: 0,
        total: 100
      })],
      subtotal: 100,
      discountTotal: 0
    });

    const totals = computeTotalsFromSubtotalAndDiscount({
      subtotal: converted.subtotal,
      discountTotal: converted.discountTotal,
      config: { enabled: true, defaultRatePercent: 12, pricesAreTaxInclusive: false }
    });

    expect(totals.taxAmount).toBe(12);
    expect(totals.total).toBe(112);
  });

  it('converts tax-inclusive line discounts to net discounts without double-subtracting', () => {
    const converted = convertLineItemsFromTaxInclusive([
      {
        description: 'Discounted item',
        quantity: 1,
        unitPrice: 112,
        discountAmount: 11.2,
        total: 100.8
      }
    ], 12);

    expect(converted.items[0]).toEqual(expect.objectContaining({
      unitPrice: 100,
      discountAmount: 10,
      total: 90
    }));
    expect(converted.subtotal).toBe(100);
    expect(converted.discountTotal).toBe(10);

    const totals = computeTotalsFromSubtotalAndDiscount({
      subtotal: converted.subtotal,
      discountTotal: converted.discountTotal,
      config: { enabled: true, defaultRatePercent: 12, pricesAreTaxInclusive: false }
    });

    expect(totals.taxAmount).toBe(10.8);
    expect(totals.total).toBe(100.8);
  });
});
