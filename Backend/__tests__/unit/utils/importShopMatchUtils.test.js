const {
  canonicalizeShopName,
  filterShopsByName,
  scoreShopNameMatch,
  shopNameMatches,
} = require('../../../utils/importShopMatchUtils');

const DANPONG_SPINTEX = { id: 'shop-1', name: 'DANPONG-SPINTEX' };
const OTHER_SHOP = { id: 'shop-2', name: 'Main Branch' };

describe('importShopMatchUtils', () => {
  it('canonicalizes dapong and danpong to the same token', () => {
    expect(canonicalizeShopName('Dapong-spintex')).toBe(canonicalizeShopName('DANPONG-SPINTEX'));
    expect(canonicalizeShopName('Danpong spintex')).toBe('danpongspintex');
  });

  it.each([
    ['Dapong', 'DANPONG-SPINTEX'],
    ['DANPONG-SPINTEX', 'DANPONG-SPINTEX'],
    ['Danpong-spintex', 'DANPONG-SPINTEX'],
    ['spintex', 'DANPONG-SPINTEX'],
    ['Dapong-spintex', 'DANPONG-SPINTEX'],
  ])('matches search "%s" to shop "%s"', (search, shopName) => {
    expect(shopNameMatches(search, shopName)).toBe(true);
    expect(scoreShopNameMatch(search, shopName)).toBeGreaterThan(0);
  });

  it('does not match unrelated shop names', () => {
    expect(shopNameMatches('Dapong', 'Main Branch')).toBe(false);
    expect(shopNameMatches('Accra', 'DANPONG-SPINTEX')).toBe(false);
  });

  it('filterShopsByName returns DANPONG-SPINTEX for common spellings', () => {
    const shops = [OTHER_SHOP, DANPONG_SPINTEX];

    for (const search of ['Dapong', 'DANPONG-SPINTEX', 'Danpong-spintex', 'spintex']) {
      const matches = filterShopsByName(shops, search);
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('shop-1');
    }
  });

  it('prefers exact score over partial when both match', () => {
    const shops = [
      { id: 'partial', name: 'DANPONG-SPINTEX Warehouse' },
      DANPONG_SPINTEX,
    ];
    const matches = filterShopsByName(shops, 'DANPONG-SPINTEX');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('shop-1');
  });
});
