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
 *   scopeReady: boolean
 * }}
 */
export function useWorkspaceScope() {
  const { activeTenantId } = useAuth();
  const shop = useShopOptional();
  const studio = useStudioLocationOptional();

  const activeShopId = shop?.activeShopId ?? null;
  const activeStudioLocationId = studio?.activeStudioLocationId ?? null;
  const isShopWorkspace = !!shop?.isShopWorkspace;
  const isStudioWorkspace = !!studio?.isStudioWorkspace;

  const scopeReady = useMemo(() => {
    if (!activeTenantId) return false;
    if (isShopWorkspace && !activeShopId) return false;
    if (isStudioWorkspace && !activeStudioLocationId) return false;
    return true;
  }, [activeTenantId, isShopWorkspace, activeShopId, isStudioWorkspace, activeStudioLocationId]);

  return {
    activeTenantId,
    activeShopId,
    activeStudioLocationId,
    isShopWorkspace,
    isStudioWorkspace,
    scopeReady,
  };
}
