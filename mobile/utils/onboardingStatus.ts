import { DEFAULT_TENANT_NAMES } from '@/constants';

/** Matches web `isPlaceholderBusinessName` — "Eric's Business", default names, etc. */
const PLACEHOLDER_PATTERN = /^.+'s (Business|Workspace)$/i;

export function isPlaceholderBusinessName(name: string | undefined | null): boolean {
  if (!name || !String(name).trim()) return true;
  const trimmed = String(name).trim();
  if (DEFAULT_TENANT_NAMES.includes(trimmed)) return true;
  return PLACEHOLDER_PATTERN.test(trimmed);
}

type TenantOnboardingShape = {
  name?: string;
  metadata?: {
    phone?: string;
    email?: string;
    onboarding?: { completedAt?: string };
  };
} | null | undefined;

/**
 * Whether workspace setup is complete — aligned with web Dashboard / Settings.
 * Complete if explicit marker exists, or real business name plus business contact on tenant metadata.
 */
export function isOnboardingComplete(tenant: TenantOnboardingShape): boolean {
  if (!tenant) return false;

  if (tenant.metadata?.onboarding?.completedAt) {
    return true;
  }

  const hasBusinessName = !!(tenant.name && !isPlaceholderBusinessName(tenant.name));

  const phone = tenant.metadata?.phone;
  const email = tenant.metadata?.email;
  const hasCompanyPhone = !!(phone && String(phone).trim());
  const hasCompanyEmail = !!(email && String(email).trim());

  return hasBusinessName && (hasCompanyPhone || hasCompanyEmail);
}

/** Merge organization settings contact fields (web reads these for onboarding status). */
export function tenantWithOrganizationContact(
  tenant: TenantOnboardingShape,
  organization?: { phone?: string; email?: string; name?: string } | null
): TenantOnboardingShape {
  if (!tenant) return tenant;
  const orgPhone = organization?.phone;
  const orgEmail = organization?.email;
  return {
    ...tenant,
    name: tenant.name || organization?.name,
    metadata: {
      ...tenant.metadata,
      phone: tenant.metadata?.phone || orgPhone,
      email: tenant.metadata?.email || orgEmail,
    },
  };
}
