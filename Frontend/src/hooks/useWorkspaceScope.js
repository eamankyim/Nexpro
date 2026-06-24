import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useShopOptional } from '../context/ShopContext';
import { useStudioLocationOptional } from '../context/StudioLocationContext';

/**
 * Active workspace scope (tenant, shop, studio) for refetching scoped API data.
 * @returns {{
 *   activeTenantId: string|null,
 *   activeShopId: string|null,
 *   activeStudioLocationId: string|null,
 *   isShopWorkspace: boolean,
 *   isStudioWorkspace: boolean,
 *   canAccessAllStudioLocations: boolean,
 *   scopeReady: boolean
 * }}
 */
export function useWorkspaceScope() {
  const { activeTenantId } = useAuth();
  const shop = useShopOptional();
  const studio = useStudioLocationOptional();

  const activeShopId = shop?.activeShopId ?? null;
  const activeStudioLocationId = studio?.activeStudioLocationId ?? null;
  const activeStudioLocation = studio?.activeLocation ?? null;
  const isShopWorkspace = !!shop?.isShopWorkspace;
  const isStudioWorkspace = !!studio?.isStudioWorkspace;
  const canAccessAllStudioLocations = !!studio?.canAccessAll;

  const scopeReady = useMemo(() => {
    if (!activeTenantId) return false;
    if (isShopWorkspace && !activeShopId) return false;
    if (isStudioWorkspace && !activeStudioLocationId && !canAccessAllStudioLocations) return false;
    return true;
  }, [
    activeTenantId,
    isShopWorkspace,
    activeShopId,
    isStudioWorkspace,
    activeStudioLocationId,
    canAccessAllStudioLocations,
  ]);

  return {
    activeTenantId,
    activeShopId,
    activeStudioLocationId,
    activeStudioLocation,
    isShopWorkspace,
    isStudioWorkspace,
    canAccessAllStudioLocations,
    scopeReady,
  };
}
