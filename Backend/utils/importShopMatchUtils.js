/**
 * Fuzzy shop name matching for import scripts.
 * Handles case differences, dapong/danpong spelling, and partial "spintex" matches.
 */

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/**
 * Canonical form for shop name comparison.
 * @param {string} value
 * @returns {string}
 */
function canonicalizeShopName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\bdapong\b/g, 'danpong')
    .replace(/[-_/\s]+/g, '');
}

/**
 * Score how well a shop name matches a search string (higher = better). Zero = no match.
 * @param {string} searchName
 * @param {string} shopName
 * @returns {number}
 */
function scoreShopNameMatch(searchName, shopName) {
  const search = canonicalizeShopName(searchName);
  const shop = canonicalizeShopName(shopName);
  if (!search || !shop) return 0;
  if (shop === search) return 100;
  if (shop.includes(search)) return 80;
  if (search.includes(shop)) return 70;
  if (search.includes('spintex') && shop.includes('spintex')) return 60;
  if (search.includes('danpong') && shop.includes('danpong')) return 50;
  return 0;
}

/**
 * Return true when search and shop names are a plausible match.
 * @param {string} searchName
 * @param {string} shopName
 * @returns {boolean}
 */
function shopNameMatches(searchName, shopName) {
  return scoreShopNameMatch(searchName, shopName) > 0;
}

/**
 * Filter shops by fuzzy name match. When multiple tie on score, all top-scoring shops are returned.
 * @param {Array<{ id: string, name: string }>} shops
 * @param {string} searchName
 * @returns {Array<{ id: string, name: string }>}
 */
function filterShopsByName(shops, searchName) {
  const scored = shops
    .map((shop) => ({ shop, score: scoreShopNameMatch(searchName, shop.name) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.shop.name.localeCompare(b.shop.name));

  if (!scored.length) return [];

  const bestScore = scored[0].score;
  return scored.filter(({ score }) => score === bestScore).map(({ shop }) => shop);
}

module.exports = {
  canonicalizeShopName,
  scoreShopNameMatch,
  shopNameMatches,
  filterShopsByName,
};
