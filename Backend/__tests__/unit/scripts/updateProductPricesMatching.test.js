const {
  skuBasePart,
  codesAreRelated,
  collectRowCodes,
  disambiguateNameMatches,
  resolveProductForRow,
} = require('../../../scripts/update-product-prices-csv-for-tenant');

function buildIndexes(products) {
  const productsByCode = new Map();
  const productsByNameList = new Map();

  for (const product of products) {
    if (product.sku) productsByCode.set(product.sku, { product, source: 'product.sku' });
    if (product.barcode) productsByCode.set(product.barcode, { product, source: 'product.barcode' });

    const nameKey = String(product.name || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const existing = productsByNameList.get(nameKey) || [];
    existing.push(product);
    productsByNameList.set(nameKey, existing);
  }

  return { products, productsByCode, productsByNameList, codeConflicts: [] };
}

describe('update-product-prices matching helpers', () => {
  test('skuBasePart extracts the import-style part number prefix', () => {
    expect(skuBasePart('36AA4132-BAJAJ-KIT-CONNECTING-ROD')).toBe('36AA4132');
    expect(skuBasePart('AA101844')).toBe('AA101844');
  });

  test('codesAreRelated matches truncated import-josfaa composite SKUs', () => {
    expect(codesAreRelated(
      '24171118-LOCAL-AXLE-ASSLY-REAR-WHEE-COMPACT',
      '24171118-LOCAL-AXLE-ASSLY-REAR-WHEE-COMPAC'
    )).toBe(true);
    expect(codesAreRelated(
      '30151059-PABLA-BEARING-BALL-C-CASE-MAGN-SIDE-6304',
      '30151059-PABLA-BEARING-BALL-C-CASE-MAGN-S'
    )).toBe(true);
  });

  test('collectRowCodes includes part number and base SKU', () => {
    expect(collectRowCodes({
      sku: '36AA4132-BAJAJ-KIT-CONNECTING-ROD',
      barcode: '36AA4132-BAJAJ-KIT-CONNECTING-ROD',
      partNo: '36AA4132',
    })).toEqual([
      '36AA4132-BAJAJ-KIT-CONNECTING-ROD',
      '36AA4132',
    ]);
  });

  test('resolveProductForRow matches short warehouse SKUs from composite CSV rows', () => {
    const indexes = buildIndexes([
      {
        id: 'p1',
        name: 'KIT CONNECTING ROD',
        sku: '36AA4132',
        barcode: null,
        brand: 'BAJAJ',
        category: null,
      },
      {
        id: 'p2',
        name: 'KIT CONNECTING ROD',
        sku: '36AA4132-MB-KIT-CONNECTING-ROD',
        barcode: null,
        brand: 'MB',
        category: null,
      },
    ]);

    const resolution = resolveProductForRow({
      name: 'KIT CONNECTING ROD',
      sku: '36AA4132-BAJAJ-KIT-CONNECTING-ROD',
      barcode: '36AA4132-BAJAJ-KIT-CONNECTING-ROD',
      partNo: '36AA4132',
      brand: 'BAJAJ',
    }, indexes);

    expect(resolution.status).toBe('matched');
    expect(resolution.product.id).toBe('p1');
    expect(resolution.matchedBy).toBe('product.sku');
  });

  test('disambiguateNameMatches picks the oldest codeless duplicate by name', () => {
    const matches = disambiguateNameMatches(
      { name: 'INNER TUBE 400*8', sku: '', barcode: '', brand: '' },
      [
        { id: 'b', name: 'INNER TUBE 400*8', sku: null, barcode: null, brand: null, category: null, createdAt: '2026-01-02' },
        { id: 'a', name: 'INNER TUBE 400*8', sku: null, barcode: null, brand: null, category: null, createdAt: '2026-01-01' },
      ]
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('a');
  });
});
