import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { isPlaceholderBusinessName } from '../constants/tenantPlaceholders';
import { QUERY_CACHE } from '../constants';

/**
 * Onboarding completion banner for settings hub (managers only).
 * @returns {{ showOnboardingBanner: boolean, organizationSettingsPending: boolean }}
 */
export const useSettingsOnboardingBanner = () => {
  const { activeTenant, isManager, wasInvited, suppressAppGuidance } = useAuth();
  const canManageOrganization = Boolean(isManager);

  const {
    data: organizationData,
    isPending: organizationSettingsPending,
  } = useQuery({
    queryKey: ['settings', 'organization', activeTenant?.id],
    queryFn: settingsService.getOrganization,
    enabled: canManageOrganization && !!activeTenant?.id,
    staleTime: QUERY_CACHE.STALE_TIME_DEFAULT,
    refetchOnWindowFocus: false,
  });

  const organizationRecord = useMemo(() => organizationData?.data || {}, [organizationData]);

  const hasBusinessNameForOnboarding = useMemo(() => {
    const name = activeTenant?.name;
    return !!(name && name.trim() && !isPlaceholderBusinessName(name));
  }, [activeTenant?.name]);

  const hasCompanyPhoneForOnboarding = useMemo(
    () => !!(organizationRecord?.phone && String(organizationRecord.phone).trim()),
    [organizationRecord?.phone]
  );

  const hasOrganizationEmailForOnboarding = useMemo(
    () => !!(organizationRecord?.email && String(organizationRecord.email).trim()),
    [organizationRecord?.email]
  );

  const onboardingCompleted = useMemo(() => {
    if (activeTenant?.metadata?.onboarding?.completedAt) return true;
    return (
      hasBusinessNameForOnboarding
      && (hasCompanyPhoneForOnboarding || hasOrganizationEmailForOnboarding)
    );
  }, [
    activeTenant?.metadata?.onboarding?.completedAt,
    hasBusinessNameForOnboarding,
    hasCompanyPhoneForOnboarding,
    hasOrganizationEmailForOnboarding,
  ]);

  const showOnboardingBanner = useMemo(() => {
    if (!canManageOrganization) return false;
    if (wasInvited) return false;
    if (suppressAppGuidance) return false;
    if (organizationSettingsPending) return false;
    return !onboardingCompleted;
  }, [canManageOrganization, wasInvited, suppressAppGuidance, organizationSettingsPending, onboardingCompleted]);

  return { showOnboardingBanner, organizationSettingsPending };
};
