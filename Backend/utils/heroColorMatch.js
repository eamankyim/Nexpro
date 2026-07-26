/**
 * Pick the hero colorway whose hexHint is closest to a brand primary color.
 */

const { normalizeHarmonyHex, hexToHsl } = require('./colorHarmony');

/**
 * Circular hue distance 0–180.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Distance score (lower = better). Prefer hue proximity; fall back to lightness.
 * @param {string} primaryHex
 * @param {string} hintHex
 * @returns {number}
 */
function colorDistance(primaryHex, hintHex) {
  const a = hexToHsl(primaryHex);
  const b = hexToHsl(hintHex);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  // Near-grayscale brand: match by lightness mainly
  if (a.s < 0.12) {
    return Math.abs(a.l - b.l) * 100 + hueDistance(a.h, b.h) * 0.05;
  }
  return hueDistance(a.h, b.h) + Math.abs(a.s - b.s) * 20 + Math.abs(a.l - b.l) * 30;
}

/**
 * @param {Array<{ id: string, hexHint?: string|null, isActive?: boolean, sortOrder?: number }>} colorways
 * @param {string} primaryColor
 * @returns {object|null}
 */
function pickClosestColorway(colorways, primaryColor) {
  const list = (Array.isArray(colorways) ? colorways : []).filter(
    (c) => c && c.isActive !== false && c.imageUrl
  );
  if (!list.length) return null;

  const primary = normalizeHarmonyHex(primaryColor, '#166534');
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const cw of list) {
    const hint = normalizeHarmonyHex(cw.hexHint);
    if (!hint) continue;
    const score = colorDistance(primary, hint);
    if (score < bestScore) {
      bestScore = score;
      best = cw;
    }
  }

  if (best) return best;

  // No hex hints — first by sortOrder
  return [...list].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))[0] || null;
}

module.exports = {
  colorDistance,
  pickClosestColorway,
};
