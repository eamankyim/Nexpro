import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import settingsService from '../services/settingsService';
import { QUERY_CACHE } from '../constants';

/**
 * Per-user sidebar visibility preferences for the active workspace.
 * @returns {{ hiddenSidebarKeys: string[], isLoading: boolean, isFetching: boolean, refetch: Function }}
 */
export const useSidebarPreferences = () => {
  const { activeTenant, isDriver } = useAuth();
  const tenantId = activeTenant?.id;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['settings', 'sidebar-preferences', tenantId],
    queryFn: async () => {
      const response = await settingsService.getSidebarPreferences();
      return response?.hiddenSidebarKeys ?? [];
    },
    enabled: !!tenantId && !isDriver,
    staleTime: QUERY_CACHE.STALE_TIME_STABLE,
  });

  return {
    hiddenSidebarKeys: data ?? [],
    isLoading,
    isFetching,
    refetch,
  };
};
