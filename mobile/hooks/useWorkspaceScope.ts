import { useMemo } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useShopOptional } from '@/context/ShopContext';
import { useStudioLocationOptional } from '@/context/StudioLocationContext';

/**
 * Active workspace scope (tenant, shop, studio) for scoped API data and React Query keys.
 * Aligned with web `useWorkspaceScope`, with studio "all locations" when `canAccessAll`.
 */
export function useWorkspaceScope() {
  const { activeTenantId } = useAuth();
  const shop = useShopOptional();
  const studio = useStudioLocationOptional();

  const activeShopId = shop?.activeShopId ?? null;
  const activeShop = shop?.activeShop ?? null;
  const activeStudioLocationId = studio?.activeStudioLocationId ?? null;
  const activeStudioLocation = studio?.activeLocation ?? null;
  const isShopWorkspace = !!shop?.isShopWorkspace;
  const isStudioWorkspace = !!studio?.isStudioWorkspace;
  const canAccessAllStudioLocations = !!studio?.canAccessAll;

  const scopeReady = useMemo(() => {
    if (!activeTenantId) return false;
    if (isShopWorkspace && (shop?.loadingShops || !activeShopId)) return false;
    if (isStudioWorkspace && studio?.loadingLocations) return false;
    if (
      isStudioWorkspace &&
      !activeStudioLocationId &&
      !canAccessAllStudioLocations
    ) {
      return false;
    }
    return true;
  }, [
    activeTenantId,
    isShopWorkspace,
    shop?.loadingShops,
    activeShopId,
    isStudioWorkspace,
    studio?.loadingLocations,
    activeStudioLocationId,
    canAccessAllStudioLocations,
  ]);

  return {
    activeTenantId,
    activeShopId,
    activeShop,
    activeStudioLocationId,
    activeStudioLocation,
    isShopWorkspace,
    isStudioWorkspace,
    canAccessAllStudioLocations,
    scopeReady,
  };
}

/** Scope segment for list query keys (matches web: tenant + shop + studio). */
export function workspaceScopeQueryKey(
  activeTenantId: string | null,
  activeShopId: string | null,
  activeStudioLocationId: string | null
) {
  return [activeTenantId, activeShopId, activeStudioLocationId] as const;
}
