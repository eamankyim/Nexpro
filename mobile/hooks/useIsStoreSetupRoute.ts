import { usePathname, useSegments } from 'expo-router';

/**
 * True while the Online Store setup wizard stack is focused.
 * Tab screens stay mounted under the root stack, so background polls
 * must check this to avoid competing with setup requests.
 */
export function useIsStoreSetupRoute(): boolean {
  const pathname = usePathname();
  const segments = useSegments();

  if (typeof pathname === 'string' && pathname.includes('store-setup')) {
    return true;
  }

  return segments.some((segment) => segment === 'store-setup');
}
