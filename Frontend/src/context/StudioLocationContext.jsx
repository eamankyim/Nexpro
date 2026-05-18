import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { STUDIO_LIKE_TYPES } from '../constants';
import studioLocationService from '../services/studioLocationService';

export const ACTIVE_STUDIO_LOCATION_STORAGE_KEY = 'activeStudioLocationId';
const STORAGE_KEY = ACTIVE_STUDIO_LOCATION_STORAGE_KEY;

const StudioLocationContext = createContext(null);

/**
 * Provides studio location list and active location for studio-type workspaces.
 */
export function StudioLocationProvider({ children }) {
  const { activeTenant, activeTenantId } = useAuth();
  const queryClient = useQueryClient();

  const isStudioWorkspace = useMemo(() => {
    const bt = activeTenant?.businessType;
    return STUDIO_LIKE_TYPES.includes(bt);
  }, [activeTenant?.businessType]);

  const [activeStudioLocationId, setActiveStudioLocationIdState] = useState(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY) || null;
  });

  const { data: accessData, isLoading } = useQuery({
    queryKey: ['studio-locations', 'access', activeTenantId],
    queryFn: () => studioLocationService.getAccess(),
    enabled: !!activeTenantId && isStudioWorkspace,
    staleTime: 2 * 60 * 1000,
  });

  const access = accessData?.data || accessData || {};
  const locations = access.locations || [];
  const canAccessAll = !!access.canAccessAll;

  useEffect(() => {
    if (!isStudioWorkspace || !activeTenantId) {
      setActiveStudioLocationIdState(null);
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    const validIds = locations.map((l) => l.id);

    if (stored && (canAccessAll || validIds.includes(stored))) {
      setActiveStudioLocationIdState(stored);
      return;
    }

    const fallback =
      access.activeStudioLocationId ||
      access.defaultStudioLocationId ||
      (locations.length === 1 ? locations[0].id : null);

    if (fallback) {
      localStorage.setItem(STORAGE_KEY, fallback);
      setActiveStudioLocationIdState(fallback);
    } else if (canAccessAll) {
      localStorage.removeItem(STORAGE_KEY);
      setActiveStudioLocationIdState(null);
    }
  }, [
    isStudioWorkspace,
    activeTenantId,
    locations,
    canAccessAll,
    access.activeStudioLocationId,
    access.defaultStudioLocationId,
  ]);

  const setActiveStudioLocation = useCallback(
    (locationId) => {
      if (locationId === 'all') {
        localStorage.removeItem(STORAGE_KEY);
        setActiveStudioLocationIdState(null);
      } else if (locationId) {
        localStorage.setItem(STORAGE_KEY, locationId);
        setActiveStudioLocationIdState(locationId);
      }
      queryClient.invalidateQueries();
    },
    [queryClient]
  );

  const refreshLocations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['studio-locations'] });
  }, [queryClient]);

  const activeLocation = useMemo(
    () => locations.find((l) => l.id === activeStudioLocationId) || null,
    [locations, activeStudioLocationId]
  );

  const value = useMemo(
    () => ({
      isStudioWorkspace,
      locations,
      canAccessAll,
      activeStudioLocationId,
      activeLocation,
      loadingLocations: isLoading,
      setActiveStudioLocation,
      refreshLocations,
    }),
    [
      isStudioWorkspace,
      locations,
      canAccessAll,
      activeStudioLocationId,
      activeLocation,
      isLoading,
      setActiveStudioLocation,
      refreshLocations,
    ]
  );

  return (
    <StudioLocationContext.Provider value={value}>
      {children}
    </StudioLocationContext.Provider>
  );
}

export const useStudioLocation = () => {
  const ctx = useContext(StudioLocationContext);
  if (!ctx) {
    throw new Error('useStudioLocation must be used within StudioLocationProvider');
  }
  return ctx;
};

export const useStudioLocationOptional = () => useContext(StudioLocationContext);
