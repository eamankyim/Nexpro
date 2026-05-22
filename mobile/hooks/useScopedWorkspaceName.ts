import { useMemo } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useShopOptional } from '@/context/ShopContext';
import { useStudioLocationOptional } from '@/context/StudioLocationContext';
import { getWorkspaceDisplayName } from '@/utils/workspaceDisplayName';

/**
 * Active workspace label: shop or studio when scoped, otherwise company/tenant name.
 * Aligned with web `useScopedWorkspaceName`.
 */
export function useScopedWorkspaceName(fallback = 'your business'): string {
  const { activeTenant } = useAuth();
  const shop = useShopOptional();
  const studio = useStudioLocationOptional();

  return useMemo(() => {
    if (shop?.isShopWorkspace && shop.activeShop?.name) {
      return shop.activeShop.name;
    }
    if (studio?.isStudioWorkspace && studio.activeLocation?.name) {
      return studio.activeLocation.name;
    }
    if (studio?.isStudioWorkspace && studio.canAccessAll && !studio.activeLocation) {
      return 'All locations';
    }
    return getWorkspaceDisplayName(activeTenant?.name, undefined, fallback);
  }, [
    shop?.isShopWorkspace,
    shop?.activeShop?.name,
    studio?.isStudioWorkspace,
    studio?.activeLocation?.name,
    studio?.canAccessAll,
    activeTenant?.name,
    fallback,
  ]);
}
