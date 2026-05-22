import { isPlaceholderBusinessName } from '@/utils/onboardingStatus';

/**
 * Display name for the active tenant when no shop/studio scope label applies.
 * Aligned with web `getWorkspaceDisplayName`.
 */
export function getWorkspaceDisplayName(
  tenantName?: string | null,
  organizationName?: string | null,
  fallback = 'your business'
): string {
  const tenant = (tenantName || '').trim();
  const org = (organizationName || '').trim();

  if (tenant && !isPlaceholderBusinessName(tenant)) return tenant;
  if (org && !isPlaceholderBusinessName(org)) return org;

  return fallback;
}
