import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { STORAGE_KEYS, resolveBusinessType } from '@/constants';
import { studioLocationService } from '@/services/studioLocationService';
import { setApiStudioLocationContext } from '@/services/api';
import { refreshAfterWorkspaceScopeChange } from '@/utils/queryInvalidation';

type StudioLocation = { id: string; name: string; isDefault?: boolean };

type StudioLocationContextValue = {
  isStudioWorkspace: boolean;
  locations: StudioLocation[];
  canAccessAll: boolean;
  activeStudioLocationId: string | null;
  activeLocation: StudioLocation | null;
  loadingLocations: boolean;
  setActiveStudioLocation: (locationId: string | 'all') => void;
};

const StudioLocationContext = createContext<StudioLocationContextValue | null>(null);

export function StudioLocationProvider({ children }: { children: ReactNode }) {
  const { activeTenant, activeTenantId } = useAuth();
  const queryClient = useQueryClient();

  const isStudioWorkspace = useMemo(
    () => resolveBusinessType(activeTenant?.businessType) === 'studio',
    [activeTenant?.businessType]
  );

  const [activeStudioLocationId, setActiveStudioLocationIdState] = useState<string | null>(null);

  const { data: access, isLoading } = useQuery({
    queryKey: ['studio-locations', 'access', activeTenantId],
    queryFn: () => studioLocationService.getAccess(),
    enabled: !!activeTenantId && isStudioWorkspace,
    staleTime: 2 * 60 * 1000,
  });

  const locations = access?.locations ?? [];
  const canAccessAll = !!access?.canAccessAll;

  useEffect(() => {
    if (!isStudioWorkspace || !activeTenantId) {
      AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_STUDIO_LOCATION_ID).catch(() => {});
      setApiStudioLocationContext(null);
      setActiveStudioLocationIdState(null);
      return;
    }
    if (isLoading) return;

    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_STUDIO_LOCATION_ID);
      const validIds = locations.map((l) => l.id);

      if (stored && validIds.includes(stored)) {
        setApiStudioLocationContext(stored);
        setActiveStudioLocationIdState(stored);
        return;
      }

      if (stored && !validIds.includes(stored)) {
        await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_STUDIO_LOCATION_ID);
      }

      const fallback =
        access?.activeStudioLocationId ||
        access?.defaultStudioLocationId ||
        (locations.length === 1 ? locations[0].id : null);

      if (fallback) {
        await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_STUDIO_LOCATION_ID, fallback);
        setApiStudioLocationContext(fallback);
        setActiveStudioLocationIdState(fallback);
      } else if (canAccessAll) {
        await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_STUDIO_LOCATION_ID);
        setApiStudioLocationContext(null);
        setActiveStudioLocationIdState(null);
      }
    })();
  }, [
    isStudioWorkspace,
    activeTenantId,
    locations,
    canAccessAll,
    access?.activeStudioLocationId,
    access?.defaultStudioLocationId,
    isLoading,
  ]);

  const setActiveStudioLocation = useCallback(
    (locationId: string | 'all') => {
      (async () => {
        if (locationId === 'all') {
          await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_STUDIO_LOCATION_ID);
          setApiStudioLocationContext(null);
          setActiveStudioLocationIdState(null);
        } else {
          await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_STUDIO_LOCATION_ID, locationId);
          setApiStudioLocationContext(locationId);
          setActiveStudioLocationIdState(locationId);
        }
        await refreshAfterWorkspaceScopeChange(queryClient);
      })();
    },
    [queryClient]
  );

  const activeLocation = useMemo(
    () => locations.find((l) => l.id === activeStudioLocationId) ?? null,
    [locations, activeStudioLocationId]
  );

  const value = useMemo<StudioLocationContextValue>(
    () => ({
      isStudioWorkspace,
      locations,
      canAccessAll,
      activeStudioLocationId,
      activeLocation,
      loadingLocations: isLoading,
      setActiveStudioLocation,
    }),
    [
      isStudioWorkspace,
      locations,
      canAccessAll,
      activeStudioLocationId,
      activeLocation,
      isLoading,
      setActiveStudioLocation,
    ]
  );

  return (
    <StudioLocationContext.Provider value={value}>{children}</StudioLocationContext.Provider>
  );
}

export function useStudioLocation() {
  const ctx = useContext(StudioLocationContext);
  if (!ctx) throw new Error('useStudioLocation must be used within StudioLocationProvider');
  return ctx;
}

export function useStudioLocationOptional() {
  return useContext(StudioLocationContext);
}
