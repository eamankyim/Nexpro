/**
 * Store brand color harmony — derive secondary/tertiary from a primary hex.
 *
 * Strategy (per-template `harmony` field):
 * - complement: secondary = warm accent for cool primaries / cool for warm
 *               (e.g. blue+orange, green+orange — not pure hue+180 magenta);
 *               tertiary = light tint of primary.
 * - analogous:  secondary = hue ±30°, slightly lighter (same family, e.g. blue+sky);
 *               tertiary = light tint of primary.
 * - tint:       secondary = same hue, much lighter (e.g. green+mint);
 *               tertiary = even lighter pastel of primary.
 * - triad:      secondary = hue + 120°, tertiary = hue + 240°.
 *
 * Low-saturation primaries fall back to tint-style companions so near-black
 * accents do not produce muddy complements.
 */

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const HEX_SHORT_COLOR_PATTERN = /^#[0-9A-Fa-f]{3}$/;

export const HARMONY_STRATEGIES = ['complement', 'analogous', 'tint', 'triad'];
export const DEFAULT_HARMONY = 'complement';

/**
 * @param {string} [value]
 * @param {string|null} [fallback]
 * @returns {string|null}
 */
export function normalizeHarmonyHex(value, fallback = null) {
  const trimmed = String(value || '').trim();
  if (HEX_COLOR_PATTERN.test(trimmed)) return trimmed.toLowerCase();
  if (HEX_SHORT_COLOR_PATTERN.test(trimmed)) {
    const [, r, g, b] = trimmed.match(/^#([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/i) || [];
    if (r && g && b) return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

/**
 * @param {string} hex
 * @returns {{ h: number, s: number, l: number }|null} h 0–360, s/l 0–1
 */
export function hexToHsl(hex) {
  const normalized = normalizeHarmonyHex(hex);
  if (!normalized) return null;
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
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
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s, l };
}

/**
 * @param {number} h 0–360
 * @param {number} s 0–1
 * @param {number} l 0–1
 * @returns {string} #rrggbb
 */
export function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.min(1, Math.max(0, s));
  const light = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c; g = x;
  } else if (hue < 120) {
    r = x; g = c;
  } else if (hue < 180) {
    g = c; b = x;
  } else if (hue < 240) {
    g = x; b = c;
  } else if (hue < 300) {
    r = x; b = c;
  } else {
    r = c; b = x;
  }
  const toByte = (channel) => Math.round((channel + m) * 255);
  return `#${[toByte(r), toByte(g), toByte(b)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * @param {string} [value]
 * @returns {'complement'|'analogous'|'tint'|'triad'}
 */
export function normalizeHarmonyStrategy(value) {
  const id = String(value || '').trim().toLowerCase();
  return HARMONY_STRATEGIES.includes(id) ? id : DEFAULT_HARMONY;
}

/**
 * Light tint of a color (same hue, higher lightness, softer saturation).
 * @param {{ h: number, s: number, l: number }} hsl
 * @param {number} [lift=0.42]
 * @returns {string}
 */
function tintFromHsl(hsl, lift = 0.42) {
  const targetL = Math.min(0.92, Math.max(hsl.l + lift, 0.72));
  const targetS = Math.min(0.75, Math.max(hsl.s * 0.55, hsl.s > 0.08 ? 0.28 : 0.08));
  return hslToHex(hsl.h, targetS, targetL);
}

/**
 * Derive secondary and tertiary companions from a primary brand color.
 * @param {string} primaryHex
 * @param {'complement'|'analogous'|'tint'|'triad'} [strategy]
 * @returns {{ secondary: string, tertiary: string }|null}
 */
export function deriveHarmoniousColors(primaryHex, strategy = DEFAULT_HARMONY) {
  const primary = normalizeHarmonyHex(primaryHex);
  const hsl = hexToHsl(primary);
  if (!primary || !hsl) return null;

  const mode = normalizeHarmonyStrategy(strategy);
  const lowSat = hsl.s < 0.1;
  const effectiveMode = lowSat ? 'tint' : mode;

  if (effectiveMode === 'tint') {
    return {
      secondary: tintFromHsl(hsl, 0.4),
      tertiary: tintFromHsl(hsl, 0.55),
    };
  }

  if (effectiveMode === 'analogous') {
    // Prefer +30° for cool primaries and −30° for warm so the pair stays lively.
    const cool = hsl.h >= 60 && hsl.h <= 250;
    const shift = cool ? 28 : -28;
    const secondaryL = Math.min(0.72, Math.max(hsl.l + 0.12, 0.45));
    const secondaryS = Math.min(0.85, Math.max(hsl.s * 0.95, 0.35));
    return {
      secondary: hslToHex(hsl.h + shift, secondaryS, secondaryL),
      tertiary: tintFromHsl(hsl, 0.45),
    };
  }

  if (effectiveMode === 'triad') {
    const secondaryL = Math.min(0.62, Math.max(hsl.l, 0.38));
    const tertiaryL = Math.min(0.7, Math.max(hsl.l + 0.08, 0.42));
    return {
      secondary: hslToHex(hsl.h + 120, Math.min(0.8, Math.max(hsl.s, 0.4)), secondaryL),
      tertiary: hslToHex(hsl.h + 240, Math.min(0.75, Math.max(hsl.s * 0.85, 0.35)), tertiaryL),
    };
  }

  // complement — warm accent for cool primaries, cool for warm (not pure +180,
  // which turns greens into magenta). Blue/green → orange; amber/red → blue.
  const coolPrimary = hsl.h >= 70 && hsl.h <= 250;
  const complementHue = coolPrimary
    ? 28 + ((hsl.h - 140) * 0.08) // orange/amber family
    : 210 + ((hsl.h > 300 ? hsl.h - 360 : hsl.h) * 0.05); // sky/blue family
  const complementL = Math.min(0.58, Math.max(0.4, hsl.l > 0.5 ? hsl.l - 0.05 : hsl.l + 0.08));
  const complementS = Math.min(0.88, Math.max(0.55, hsl.s * 0.9 + 0.15));
  return {
    secondary: hslToHex(complementHue, complementS, complementL),
    tertiary: tintFromHsl(hsl, 0.45),
  };
}

/**
 * Fill missing secondary/tertiary from primary using the template harmony strategy.
 * Existing non-empty values are preserved.
 * @param {string} primaryHex
 * @param {{ secondary?: string|null, tertiary?: string|null }} [existing]
 * @param {'complement'|'analogous'|'tint'|'triad'} [strategy]
 * @param {{ hasSecondary?: boolean, hasTertiary?: boolean }} [slots]
 * @returns {{ secondary: string|null, tertiary: string|null }}
 */
export function fillHarmoniousSlots(primaryHex, existing = {}, strategy = DEFAULT_HARMONY, slots = {}) {
  const hasSecondary = slots.hasSecondary !== false;
  const hasTertiary = slots.hasTertiary === true;
  const derived = deriveHarmoniousColors(primaryHex, strategy);
  const secondaryExisting = normalizeHarmonyHex(existing.secondary);
  const tertiaryExisting = normalizeHarmonyHex(existing.tertiary);

  return {
    secondary: hasSecondary
      ? (secondaryExisting || derived?.secondary || null)
      : null,
    tertiary: hasTertiary
      ? (tertiaryExisting || derived?.tertiary || null)
      : null,
  };
}

/**
 * Re-derive secondary/tertiary from primary (ignores existing companions).
 * @param {string} primaryHex
 * @param {'complement'|'analogous'|'tint'|'triad'} [strategy]
 * @param {{ hasSecondary?: boolean, hasTertiary?: boolean }} [slots]
 * @returns {{ secondary: string|null, tertiary: string|null }}
 */
export function matchColorsToPrimary(primaryHex, strategy = DEFAULT_HARMONY, slots = {}) {
  return fillHarmoniousSlots(primaryHex, {}, strategy, slots);
}
