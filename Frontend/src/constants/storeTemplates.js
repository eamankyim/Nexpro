/**
 * Online Store visual template registry (ABS Frontend).
 * Keep in sync with Backend/config/storeTemplates.js and storefront/src/templates/registry.js
 *
 * Per-template `harmony` drives auto secondary/tertiary from primary:
 * complement | analogous | tint | triad — see utils/colorHarmony.js
 */

import {
  DEFAULT_HARMONY,
  deriveHarmoniousColors,
  fillHarmoniousSlots,
  matchColorsToPrimary,
  normalizeHarmonyStrategy,
} from '../utils/colorHarmony';

export const DEFAULT_TEMPLATE_ID = 'classic';

export const COLOR_KEY_TO_FIELD = {
  primary: 'primaryColor',
  secondary: 'secondaryColor',
  tertiary: 'tertiaryColor',
};

export const STORE_TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic',
    tagline: 'Clean green header, search bar, and product grid',
    tags: ['Default', 'Trusted'],
    previewAccent: '#166534',
    harmony: 'tint',
    colorSlots: [
      { key: 'primary', label: 'Primary color', cssVar: '--store-accent', default: '#166534' },
      { key: 'secondary', label: 'Secondary color', cssVar: '--store-secondary', default: '#86efac' },
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    tagline: 'Light whitespace, thin type, quiet commerce',
    tags: ['Simple', 'Modern'],
    previewAccent: '#0f172a',
    harmony: 'tint',
    colorSlots: [
      { key: 'primary', label: 'Accent color', cssVar: '--store-accent', default: '#0f172a' },
    ],
  },
  {
    id: 'bold',
    name: 'Bold',
    tagline: 'Strong hero, high contrast, statement branding',
    tags: ['Impact', 'Retail'],
    previewAccent: '#f59e0b',
    harmony: 'complement',
    colorSlots: [
      { key: 'primary', label: 'Primary accent', cssVar: '--store-accent', default: '#f59e0b' },
      { key: 'secondary', label: 'Secondary color', cssVar: '--store-secondary', default: '#0e6dd9' },
      { key: 'tertiary', label: 'Highlight color', cssVar: '--store-tertiary', default: '#fde68a' },
    ],
  },
  {
    id: 'marketplace',
    name: 'Dense',
    tagline: 'Compact catalog layout with category chips and tight product cards',
    tags: ['Catalog', 'Busy'],
    previewAccent: '#0369a1',
    harmony: 'analogous',
    colorSlots: [
      { key: 'primary', label: 'Primary color', cssVar: '--store-accent', default: '#0369a1' },
      { key: 'secondary', label: 'Chip / badge color', cssVar: '--store-secondary', default: '#0ea5e9' },
    ],
  },
  {
    id: 'catalog',
    name: 'Catalog',
    tagline: 'Magazine-style hero and spacious product rows',
    tags: ['Premium', 'Lookbook'],
    previewAccent: '#7c3aed',
    harmony: 'tint',
    colorSlots: [
      { key: 'primary', label: 'Primary color', cssVar: '--store-accent', default: '#7c3aed' },
      { key: 'secondary', label: 'Secondary color', cssVar: '--store-secondary', default: '#a78bfa' },
    ],
  },
];

export const STORE_TEMPLATE_IDS = STORE_TEMPLATES.map((t) => t.id);

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const HEX_SHORT_COLOR_PATTERN = /^#[0-9A-Fa-f]{3}$/;

/**
 * @param {string} [value]
 * @param {string|null} [fallback]
 * @returns {string|null}
 */
export const normalizeHexColor = (value, fallback = null) => {
  const trimmed = String(value || '').trim();
  if (HEX_COLOR_PATTERN.test(trimmed)) return trimmed.toLowerCase();
  if (HEX_SHORT_COLOR_PATTERN.test(trimmed)) {
    const [, r, g, b] = trimmed.match(/^#([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/i) || [];
    if (r && g && b) return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
};

/**
 * @param {string} [value]
 * @returns {string}
 */
export const normalizeTemplateId = (value) => {
  const id = String(value || '').trim().toLowerCase();
  return STORE_TEMPLATE_IDS.includes(id) ? id : DEFAULT_TEMPLATE_ID;
};

/**
 * @param {string} [id]
 */
export const getStoreTemplate = (id) =>
  STORE_TEMPLATES.find((t) => t.id === normalizeTemplateId(id)) || STORE_TEMPLATES[0];

/**
 * @param {string} [templateId]
 * @returns {'complement'|'analogous'|'tint'|'triad'}
 */
export const getTemplateHarmony = (templateId) =>
  normalizeHarmonyStrategy(getStoreTemplate(templateId).harmony || DEFAULT_HARMONY);

/**
 * @param {string} [templateId]
 * @returns {Array<{ key: string, label: string, cssVar: string, default: string }>}
 */
export const getTemplateColorSlots = (templateId) => {
  const template = getStoreTemplate(templateId);
  return Array.isArray(template.colorSlots) ? template.colorSlots : [];
};

/**
 * @param {string} [templateId]
 * @returns {{ primary?: string, secondary?: string, tertiary?: string }}
 */
export const getTemplateDefaultColors = (templateId) =>
  getTemplateColorSlots(templateId).reduce((acc, slot) => {
    acc[slot.key] = slot.default;
    return acc;
  }, {});

/**
 * Slot presence for the active template.
 * @param {string} [templateId]
 * @returns {{ hasSecondary: boolean, hasTertiary: boolean }}
 */
export const getTemplateColorSlotFlags = (templateId) => {
  const keys = new Set(getTemplateColorSlots(templateId).map((s) => s.key));
  return {
    hasSecondary: keys.has('secondary'),
    hasTertiary: keys.has('tertiary'),
  };
};

/**
 * Resolve merchant colors against the active template's slots.
 * Missing secondary/tertiary are filled from primary via the template harmony strategy
 * (not only static slot defaults).
 * @param {string} [templateId]
 * @param {Record<string, string|null|undefined>} [colors]
 * @returns {{ primary?: string, secondary?: string, tertiary?: string }}
 */
export const resolveStoreBrandColors = (templateId, colors = {}) => {
  const source = colors && typeof colors === 'object' ? colors : {};
  const slots = getTemplateColorSlots(templateId);
  const defaults = getTemplateDefaultColors(templateId);
  const primaryRaw = source.primary != null ? source.primary : source.primaryColor;
  const primary = normalizeHexColor(primaryRaw, defaults.primary) || defaults.primary;

  const existingSecondary = source.secondary != null ? source.secondary : source.secondaryColor;
  const existingTertiary = source.tertiary != null ? source.tertiary : source.tertiaryColor;
  const filled = fillHarmoniousSlots(
    primary,
    { secondary: existingSecondary, tertiary: existingTertiary },
    getTemplateHarmony(templateId),
    getTemplateColorSlotFlags(templateId),
  );

  return slots.reduce((acc, slot) => {
    if (slot.key === 'primary') {
      acc.primary = primary || slot.default;
      return acc;
    }
    if (slot.key === 'secondary') {
      acc.secondary = normalizeHexColor(filled.secondary, slot.default) || slot.default;
      return acc;
    }
    if (slot.key === 'tertiary') {
      acc.tertiary = normalizeHexColor(filled.tertiary, slot.default) || slot.default;
      return acc;
    }
    const field = COLOR_KEY_TO_FIELD[slot.key];
    const raw = source[slot.key] != null ? source[slot.key] : source[field];
    acc[slot.key] = normalizeHexColor(raw, slot.default) || slot.default;
    return acc;
  }, {});
};

/**
 * @param {string} [templateId]
 * @param {Record<string, string|null|undefined>} [colors]
 * @returns {Record<string, string>}
 */
export const buildStoreColorCssVars = (templateId, colors = {}) => {
  const resolved = resolveStoreBrandColors(templateId, colors);
  return getTemplateColorSlots(templateId).reduce((vars, slot) => {
    const value = resolved[slot.key];
    vars[slot.cssVar] = value;
    if (slot.key === 'primary') vars['--store-accent-soft'] = `${value}22`;
    if (slot.key === 'secondary') vars['--store-secondary-soft'] = `${value}22`;
    if (slot.key === 'tertiary') vars['--store-tertiary-soft'] = `${value}22`;
    return vars;
  }, {});
};

/**
 * On template change / first load: keep saved colors for slots that still exist;
 * fill missing companions from primary via harmony (not only static defaults).
 * @param {string} [templateId]
 * @param {{ primaryColor?: string|null, secondaryColor?: string|null, tertiaryColor?: string|null }} [saved]
 * @returns {{ primaryColor: string, secondaryColor: string|null, tertiaryColor: string|null }}
 */
export const mergeColorsForTemplate = (templateId, saved = {}) => {
  const slots = getTemplateColorSlots(templateId);
  const defaults = getTemplateDefaultColors(templateId);
  const slotKeys = new Set(slots.map((s) => s.key));
  const primaryColor = slotKeys.has('primary')
    ? (normalizeHexColor(saved.primaryColor, defaults.primary) || defaults.primary || '#166534')
    : (defaults.primary || '#166534');

  const filled = fillHarmoniousSlots(
    primaryColor,
    {
      secondary: saved.secondaryColor,
      tertiary: saved.tertiaryColor,
    },
    getTemplateHarmony(templateId),
    {
      hasSecondary: slotKeys.has('secondary'),
      hasTertiary: slotKeys.has('tertiary'),
    },
  );

  return {
    primaryColor,
    secondaryColor: slotKeys.has('secondary')
      ? (filled.secondary || defaults.secondary || null)
      : null,
    tertiaryColor: slotKeys.has('tertiary')
      ? (filled.tertiary || defaults.tertiary || null)
      : null,
  };
};

/**
 * Derive linked secondary/tertiary for the current template from a primary color.
 * @param {string} [templateId]
 * @param {string} primaryHex
 * @returns {{ secondaryColor: string|null, tertiaryColor: string|null }}
 */
export const deriveTemplateCompanionColors = (templateId, primaryHex) => {
  const flags = getTemplateColorSlotFlags(templateId);
  const matched = matchColorsToPrimary(primaryHex, getTemplateHarmony(templateId), flags);
  return {
    secondaryColor: flags.hasSecondary ? matched.secondary : null,
    tertiaryColor: flags.hasTertiary ? matched.tertiary : null,
  };
};

export {
  DEFAULT_HARMONY,
  deriveHarmoniousColors,
  fillHarmoniousSlots,
  matchColorsToPrimary,
};
