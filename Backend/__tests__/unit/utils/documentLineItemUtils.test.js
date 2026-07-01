const {
  enrichDocumentLineItems,
  getAlternateBarcodeFromRecord,
  getLineItemUnitSymbol,
  resolveDocumentLineItemProductCode,
} = require('../../../utils/documentLineItemUtils');

describe('documentLineItemUtils', () => {
  it('returns alternate barcode from barcodes relation', () => {
    expect(getAlternateBarcodeFromRecord({
      barcodes: [
        { barcode: 'ALT-001', isActive: true },
        { barcode: 'ALT-002', isActive: false },
      ],
    })).toBe('ALT-001');
  });

  it('resolves product code from alternate barcode before primary barcode', () => {
    expect(resolveDocumentLineItemProductCode({
      item: { description: 'Tiles' },
      product: {
        sku: 'SKU-1',
        barcode: 'PRIMARY',
        barcodes: [{ barcode: 'TILE-CODE', isActive: true }],
      },
    })).toBe('TILE-CODE');
  });

  it('resolves unit from linked product when item has no unit', () => {
    expect(getLineItemUnitSymbol(
      { productId: 'prod-1' },
      { product: { unit: 'sqm' } },
    )).toBe('sqm');
  });

  it('enriches invoice line items with product code and unit', () => {
    const productsById = new Map([[
      'prod-1',
      {
        id: 'prod-1',
        sku: 'SKU-1',
        barcode: 'PRIMARY',
        unit: 'sqm',
        barcodes: [{ barcode: 'TILE-CODE', isActive: true }],
      },
    ]]);

    const enriched = enrichDocumentLineItems([
      { description: 'Tiles', quantity: 10, productId: 'prod-1' },
    ], { productsById });

    expect(enriched[0].productCode).toBe('TILE-CODE');
    expect(enriched[0].unit).toBe('sqm');
  });

  it('resolves catalog product code without sku or primary barcode fallback', () => {
    const { resolveCatalogProductCode } = require('../../../utils/documentLineItemUtils');

    expect(resolveCatalogProductCode({
      sku: 'SKU-ONLY',
      barcode: 'PRIMARY-BC',
      barcodes: [{ barcode: 'ALT-CODE', isActive: true }],
    })).toBe('ALT-CODE');

    expect(resolveCatalogProductCode({
      sku: 'SKU-ONLY',
      barcode: 'PRIMARY-BC',
    })).toBe('');

    expect(resolveCatalogProductCode({
      productCode: 'META-CODE',
      sku: 'SKU-ONLY',
      barcode: 'PRIMARY-BC',
    })).toBe('META-CODE');
  });

  it('falls back to sale item metadata for product code and unit', () => {
    const enriched = enrichDocumentLineItems([
      { description: 'Tiles', quantity: 10 },
    ], {
      saleItems: [{
        metadata: { productCode: 'SALE-CODE', unit: 'pcs' },
      }],
    });

    expect(enriched[0].productCode).toBe('SALE-CODE');
    expect(enriched[0].unit).toBe('pcs');
  });
});
