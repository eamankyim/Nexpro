import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useShopOptional } from '../context/ShopContext';
import { useStudioLocationOptional } from '../context/StudioLocationContext';
import { getWorkspaceDisplayName } from '../constants';

/**
 * Display name for the active workspace scope: shop or studio when selected,
 * otherwise organization / tenant name.
 * @param {string} [organizationName] - Optional org name from settings
 * @param {string} [fallback]
 * @returns {string}
 */
export function useScopedWorkspaceName(organizationName, fallback = 'your business') {
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
    return getWorkspaceDisplayName(activeTenant?.name, organizationName, fallback);
  }, [
    shop?.isShopWorkspace,
    shop?.activeShop?.name,
    studio?.isStudioWorkspace,
    studio?.activeLocation?.name,
    activeTenant?.name,
    organizationName,
    fallback,
  ]);
}

/**
 * True when the user is limited to assigned shops (not workspace-wide admin access).
 */
export function useIsShopScopedUser() {
  const shop = useShopOptional();
  return useMemo(
    () => !!(shop?.isShopWorkspace && !shop?.canAccessAll && shop?.shops?.length > 0),
    [shop?.isShopWorkspace, shop?.canAccessAll, shop?.shops?.length]
  );
}
