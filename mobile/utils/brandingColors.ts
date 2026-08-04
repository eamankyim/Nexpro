import { STORE_PRIMARY_FALLBACK, isValidPrimaryColor, normalizePrimaryColor } from '@/utils/onlineStoreDefaults';

const DEFAULT_PRIMARY = STORE_PRIMARY_FALLBACK;

/**
 * WCAG relative luminance for sRGB channels in 0–1.
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Text/icon color on a primary fill — white or near-black for contrast.
 * Mirrors Frontend `primaryForegroundHslForHex` threshold.
 */
export function primaryForegroundHexForHex(hex: string): string {
  const normalized = normalizePrimaryColor(hex, '');
  if (!isValidPrimaryColor(normalized)) return '#ffffff';
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  return relativeLuminance(r, g, b) > 0.55 ? '#111827' : '#ffffff';
}

/**
 * Resolve workspace brand primary from org settings + tenant metadata.
 * Same priority as web BrandingContext / onlineStoreDefaults.
 */
export function resolveWorkspacePrimaryColor(
  organization: { primaryColor?: unknown } | null | undefined,
  tenantMetadata?: Record<string, unknown> | null
): string {
  const candidates = [
    organization?.primaryColor,
    tenantMetadata?.primaryColor,
    tenantMetadata?.brandColor,
  ];
  for (const candidate of candidates) {
    const trimmed = String(candidate || '').trim();
    if (isValidPrimaryColor(trimmed)) {
      return normalizePrimaryColor(trimmed);
    }
  }
  return DEFAULT_PRIMARY;
}

export { DEFAULT_PRIMARY };
