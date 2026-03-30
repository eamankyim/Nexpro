import { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import settingsService from '@/services/settingsService';
import { hexToHslTriplet, primaryForegroundHslForHex } from '@/utils/brandingColors';

const DEFAULT_APP_NAME = 'ABS';
const DEFAULT_PRIMARY = '#166534';
const DEFAULT_PRIMARY_DARK = '#14532d';
const BrandingContext = createContext(null);

/**
 * Darken a hex color by a percentage
 * @param {string} hex - e.g. #166534
 * @param {number} percent - 0–100
 * @returns {string} hex
 */
function darkenHex(hex, percent = 10) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return DEFAULT_PRIMARY_DARK;
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - percent / 100));
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - percent / 100));
  const b = Math.max(0, (num & 0xff) * (1 - percent / 100));
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
}

function clearBrandingCssVars(root) {
  const keys = [
    '--color-primary',
    '--color-primary-dark',
    '--color-primary-light',
    '--color-primary-lighter',
    '--color-success',
    '--color-info',
    '--color-loader',
    '--color-focus',
    '--color-link',
    '--color-link-hover',
    '--primary',
    '--ring',
    '--primary-foreground',
  ];
  keys.forEach((k) => root.style.removeProperty(k));
}

export function BrandingProvider({ children }) {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.id ?? null;
  const isEnterprise = activeTenant?.plan === 'enterprise';

  const { data: organizationData } = useQuery({
    queryKey: ['settings', 'organization', tenantId],
    queryFn: () => settingsService.getOrganizationSettings(),
    enabled: !!tenantId,
  });

  const organization = useMemo(() => {
    if (!tenantId) return {};
    return organizationData?.data ?? organizationData ?? {};
  }, [tenantId, organizationData]);

  const appName = useMemo(() => {
    if (!isEnterprise) return DEFAULT_APP_NAME;
    const name = (organization.appName || '').trim();
    return name || DEFAULT_APP_NAME;
  }, [isEnterprise, organization.appName]);

  /** Any workspace can set primary in Organization settings; drives buttons (via --primary) and bg-brand utilities. */
  const primaryColor = useMemo(() => {
    const color = (organization.primaryColor || '').trim();
    if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) return null;
    return color;
  }, [organization.primaryColor]);

  useEffect(() => {
    const root = document.documentElement;
    if (primaryColor) {
      const hsl = hexToHslTriplet(primaryColor);
      const fg = primaryForegroundHslForHex(primaryColor);
      root.style.setProperty('--color-primary', primaryColor);
      root.style.setProperty('--color-primary-dark', darkenHex(primaryColor, 12));
      root.style.setProperty('--color-primary-light', primaryColor + '1a');
      root.style.setProperty('--color-primary-lighter', primaryColor + '0d');
      root.style.setProperty('--color-success', primaryColor);
      root.style.setProperty('--color-info', primaryColor);
      root.style.setProperty('--color-loader', primaryColor);
      root.style.setProperty('--color-focus', primaryColor);
      root.style.setProperty('--color-link', primaryColor);
      root.style.setProperty('--color-link-hover', darkenHex(primaryColor, 12));
      if (hsl) {
        root.style.setProperty('--primary', hsl);
        root.style.setProperty('--ring', hsl);
        root.style.setProperty('--primary-foreground', fg);
      }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', primaryColor);
    } else {
      clearBrandingCssVars(root);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', DEFAULT_PRIMARY);
    }
    return () => {
      clearBrandingCssVars(root);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', DEFAULT_PRIMARY);
    };
  }, [primaryColor]);

  const value = useMemo(
    () => ({
      appName,
      primaryColor: primaryColor || DEFAULT_PRIMARY,
      primaryColorRaw: primaryColor,
      /** True when enterprise plan and a custom app name is set (logo/name white-label). */
      isEnterpriseBranding: Boolean(isEnterprise && (organization.appName || '').trim()),
    }),
    [appName, primaryColor, isEnterprise, organization.appName]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      appName: DEFAULT_APP_NAME,
      primaryColor: DEFAULT_PRIMARY,
      primaryColorRaw: null,
      isEnterpriseBranding: false,
    };
  }
  return ctx;
}

export { DEFAULT_PRIMARY };
