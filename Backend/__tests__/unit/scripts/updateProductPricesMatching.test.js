const {
  skuBasePart,
  codesAreRelated,
  collectRowCodes,
  isBarePartLookupCode,
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

  test('isBarePartLookupCode deprioritizes duplicate short part numbers when composite SKU is present', () => {
    const row = {
      sku: '36AA4132-MB-KIT-CONNECTING-ROD',
      barcode: '36AA4132-MB-KIT-CONNECTING-ROD',
      partNo: '36AA4132',
    };
    const rowCodes = collectRowCodes(row);

    expect(isBarePartLookupCode('36AA4132', row, rowCodes)).toBe(true);
    expect(isBarePartLookupCode('36AA4132-MB-KIT-CONNECTING-ROD', row, rowCodes)).toBe(false);
    expect(isBarePartLookupCode('GKI', {
      sku: 'GKI-GKI-GASKET-KIT-BS6',
      barcode: 'GKI-GKI-GASKET-KIT-BS6',
      partNo: 'GKI',
    }, collectRowCodes({
      sku: 'GKI-GKI-GASKET-KIT-BS6',
      barcode: 'GKI-GKI-GASKET-KIT-BS6',
      partNo: 'GKI',
    }))).toBe(true);
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

  test('resolveProductForRow prefers composite SKU over duplicate short part number (row 59)', () => {
    const indexes = buildIndexes([
      {
        id: 'bajaj',
        name: 'KIT CONNECTING ROD',
        sku: '36AA4132',
        barcode: '36AA4132-BAJAJ-KIT-CONNECTING-ROD',
        brand: 'BAJAJ',
        category: null,
      },
      {
        id: 'mb',
        name: 'KIT CONNECTING ROD',
        sku: '36AA4132-MB-KIT-CONNECTING-ROD',
        barcode: '36AA4132-MB-KIT-CONNECTING-ROD',
        brand: 'MB',
        category: null,
      },
    ]);

    const resolution = resolveProductForRow({
      name: 'KIT CONNECTING ROD',
      sku: '36AA4132-MB-KIT-CONNECTING-ROD',
      barcode: '36AA4132-MB-KIT-CONNECTING-ROD',
      partNo: '36AA4132',
      brand: 'MB',
      costPrice: 53.87,
      sellingPrice: 77,
    }, indexes);

    expect(resolution.status).toBe('matched');
    expect(resolution.product.id).toBe('mb');
  });

  test('resolveProductForRow resolves duplicate part numbers for bearing, gasket, piston, and gear rows', () => {
    const indexes = buildIndexes([
      { id: 'bearing-bajaj', name: 'BEARINH NEEDLE (SL 3520)', sku: '59200012', barcode: '59200012-BAJAJ-BEARINH-NEEDLE-SL-3520', brand: 'BAJAJ', category: null },
      { id: 'bearing-pabla', name: 'BEARING NEEDDLE SL-3520', sku: '59200012-PABLA-BEARING-NEEDDLE-SL-3520', barcode: '59200012-PABLA-BEARING-NEEDDLE-SL-3520', brand: 'PABLA', category: null },
      { id: 'gasket-bs4', name: 'GASKET KIT BS4 GKI', sku: 'GKI', barcode: 'GKI-GKI-GASKET-KIT-BS4-GKI', brand: 'GKI', category: null },
      { id: 'gasket-bs6', name: 'GASKET KIT BS6', sku: 'GKI-GKI-GASKET-KIT-BS6', barcode: 'GKI-GKI-GASKET-KIT-BS6', brand: 'GKI', category: null },
      { id: 'piston-plus', name: 'PISTON & RINGS +1 (COMPACT)', sku: 'HF-HF-PISTON-RINGS-1-COMPACT', barcode: 'HF-HF-PISTON-RINGS-1-COMPACT', brand: 'HF', category: null },
      { id: 'piston-std', name: 'PISTON & RINGS STD (COMPACT)', sku: 'HF', barcode: 'HF-HF-PISTON-RINGS-STD-COMPACT', brand: 'HF', category: null },
      { id: 'gear-bajaj', name: 'GEAR CABL2524 COM 4S', sku: 'AA191093', barcode: 'AA191093-BAJAJ-GEAR-CABL2524-COM-4S', brand: 'BAJAJ', category: null },
      { id: 'gear-local', name: 'GEAR CABL2524 COM 4S', sku: 'AA191093-LOCAL-GEAR-CABL2524-COM-4S', barcode: 'AA191093-LOCAL-GEAR-CABL2524-COM-4S', brand: 'LOCAL', category: { name: 'LOCAL' } },
      { id: 'gear20-bajaj', name: 'GEAR CABL2520 COM 4S', sku: 'AA191094', barcode: 'AA191094-BAJAJ-GEAR-CABL2520-COM-4S', brand: 'BAJAJ', category: null },
      { id: 'gear20-local', name: 'GEAR CABL2520 COM 4S', sku: 'AA191094-LOCAL-GEAR-CABL2520-COM-4S', barcode: 'AA191094-LOCAL-GEAR-CABL2520-COM-4S', brand: 'LOCAL', category: { name: 'LOCAL' } },
    ]);

    expect(resolveProductForRow({
      name: 'BEARING NEEDDLE SL-3520',
      sku: '59200012-PABLA-BEARING-NEEDDLE-SL-3520',
      barcode: '59200012-PABLA-BEARING-NEEDDLE-SL-3520',
      partNo: '59200012',
      brand: 'PABLA',
    }, indexes).product.id).toBe('bearing-pabla');

    expect(resolveProductForRow({
      name: 'GASKET KIT BS6',
      sku: 'GKI-GKI-GASKET-KIT-BS6',
      barcode: 'GKI-GKI-GASKET-KIT-BS6',
      partNo: 'GKI',
      brand: 'GKI',
    }, indexes).product.id).toBe('gasket-bs6');

    expect(resolveProductForRow({
      name: 'PISTON & RINGS STD (COMPACT)',
      sku: 'HF-HF-PISTON-RINGS-STD-COMPACT',
      barcode: 'HF-HF-PISTON-RINGS-STD-COMPACT',
      partNo: 'HF',
      brand: 'HF',
    }, indexes).product.id).toBe('piston-std');

    expect(resolveProductForRow({
      name: 'GEAR CABL2524 COM 4S',
      sku: 'AA191093-LOCAL-GEAR-CABL2524-COM-4S',
      barcode: 'AA191093-LOCAL-GEAR-CABL2524-COM-4S',
      partNo: 'AA191093',
      brand: 'LOCAL',
    }, indexes).product.id).toBe('gear-local');

    expect(resolveProductForRow({
      name: 'GEAR CABL2520 COM 4S',
      sku: 'AA191094-LOCAL-GEAR-CABL2520-COM-4S',
      barcode: 'AA191094-LOCAL-GEAR-CABL2520-COM-4S',
      partNo: 'AA191094',
      brand: 'LOCAL',
    }, indexes).product.id).toBe('gear20-local');
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

  test('disambiguateNameMatches treats empty-string codes as codeless and uses price proximity', () => {
    const matches = disambiguateNameMatches(
      {
        name: 'SLIDER BLOCK KIT BS6',
        sku: '',
        barcode: '',
        brand: '',
        costPrice: 3.21,
        sellingPrice: 5.30,
      },
      [
        {
          id: 'duplicate',
          name: 'SLIDER BLOCK KIT BS6',
          sku: '',
          barcode: '',
          brand: null,
          category: { name: 'LOCAL' },
          costPrice: 2.86,
          sellingPrice: 4.10,
          createdAt: '2026-01-01',
        },
        {
          id: 'target',
          name: 'SLIDER BLOCK KIT BS6',
          sku: '',
          barcode: '',
          brand: null,
          category: null,
          costPrice: 0,
          sellingPrice: 0,
          createdAt: '2026-01-02',
        },
      ]
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('target');
  });

  test('resolveProductForRow resolves name-only duplicate rows 105 and 126', () => {
    const indexes = buildIndexes([
      {
        id: 'slider-local',
        name: 'SLIDER BLOCK KIT BS6',
        sku: '',
        barcode: '',
        brand: null,
        category: { name: 'LOCAL' },
        costPrice: 2.86,
        sellingPrice: 4.10,
        createdAt: '2026-01-01',
      },
      {
        id: 'slider-target',
        name: 'SLIDER BLOCK KIT BS6',
        sku: '',
        barcode: '',
        brand: null,
        category: null,
        costPrice: 0,
        sellingPrice: 0,
        createdAt: '2026-01-02',
      },
      {
        id: 'tube-old',
        name: 'INNER TUBE 400*8',
        sku: '',
        barcode: '',
        brand: null,
        category: null,
        costPrice: 0,
        sellingPrice: 0,
        createdAt: '2026-01-01',
      },
      {
        id: 'tube-new',
        name: 'INNER TUBE 400*8',
        sku: '',
        barcode: '',
        brand: null,
        category: null,
        costPrice: 19.36,
        sellingPrice: 27.80,
        createdAt: '2026-01-02',
      },
    ]);

    expect(resolveProductForRow({
      name: 'SLIDER BLOCK KIT BS6',
      sku: '',
      barcode: '',
      brand: '',
      costPrice: 3.21,
      sellingPrice: 5.30,
    }, indexes)).toMatchObject({ status: 'matched', product: { id: 'slider-target' } });

    expect(resolveProductForRow({
      name: 'INNER TUBE 400*8',
      sku: '',
      barcode: '',
      brand: '',
      costPrice: 19.36,
      sellingPrice: 27.80,
    }, indexes)).toMatchObject({ status: 'matched', product: { id: 'tube-new' } });
  });
});
