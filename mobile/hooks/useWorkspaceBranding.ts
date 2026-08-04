import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { settingsService } from '@/services/settings';
import {
  primaryForegroundHexForHex,
  resolveWorkspacePrimaryColor,
} from '@/utils/brandingColors';
import { getPlainObject, isValidPrimaryColor } from '@/utils/onlineStoreDefaults';

export type WorkspaceBranding = {
  /** Brand / primary tint used for chips, buttons, accents */
  primaryColor: string;
  /** Readable text/icon color on primary fills */
  onPrimary: string;
  /** True when org or tenant metadata set an explicit brand color */
  hasCustomPrimary: boolean;
};

/**
 * Workspace branding from Organization settings (`primaryColor`), matching web BrandingContext.
 * Falls back to tenant metadata, then ABS green.
 */
export function useWorkspaceBranding(): WorkspaceBranding {
  const { activeTenantId, activeTenant } = useAuth();

  const { data: organization } = useQuery({
    queryKey: ['settings', 'organization', activeTenantId],
    queryFn: settingsService.getOrganizationSettings,
    enabled: !!activeTenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  return useMemo(() => {
    const org = getPlainObject(organization);
    const metadata = getPlainObject(activeTenant?.metadata);
    const primaryColor = resolveWorkspacePrimaryColor(org, metadata);
    const hasCustomPrimary = [org.primaryColor, metadata.primaryColor, metadata.brandColor].some(
      (value) => isValidPrimaryColor(value)
    );

    return {
      primaryColor,
      onPrimary: primaryForegroundHexForHex(primaryColor),
      hasCustomPrimary,
    };
  }, [organization, activeTenant?.metadata]);
}
