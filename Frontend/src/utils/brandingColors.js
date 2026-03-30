/**
 * Convert #RRGGBB to H S% L% for shadcn tokens (used as hsl(var(--primary))).
 * @param {string} hex
 * @returns {string|null}
 */
export function hexToHslTriplet(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
      default:
        h = 0;
        break;
    }
  }
  const H = Math.round(h * 360);
  const S = Math.round(s * 100);
  const L = Math.round(l * 100);
  return `${H} ${S}% ${L}%`;
}

/**
 * WCAG relative luminance
 * @param {{ r: number, g: number, b: number }} rgb — channels 0–1
 */
export function relativeLuminance({ r, g, b }) {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * HSL triplet for text on top of primary fill (white or near-black).
 * @param {string} hex
 * @returns {string} e.g. "0 0% 100%" or "222 47% 11%"
 */
export function primaryForegroundHslForHex(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return '0 0% 100%';
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lum = relativeLuminance({ r, g, b });
  return lum > 0.55 ? '222 47% 11%' : '0 0% 100%';
}
