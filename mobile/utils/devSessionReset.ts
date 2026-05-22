import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS } from '@/constants';

const AUTH_ASYNC_STORAGE_KEYS = [
  'user',
  'tenantMemberships',
  STORAGE_KEYS.ACTIVE_TENANT_ID,
  STORAGE_KEYS.ACTIVE_STUDIO_LOCATION_ID,
  STORAGE_KEYS.ACTIVE_SHOP_ID,
  STORAGE_KEYS.INTRO_ONBOARDING_COMPLETED,
];

/** Clear local app state used by auth, onboarding, scopes, cart, and query persistence. */
export async function resetLocalSessionForOnboardingTest(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const dynamicKeys = allKeys.filter(
    (key) =>
      key.startsWith(STORAGE_KEYS.CART_PREFIX) ||
      key.startsWith('REACT_QUERY_OFFLINE_CACHE') ||
      key.includes('reactQuery')
  );

  await SecureStore.deleteItemAsync(STORAGE_KEYS.token);
  await AsyncStorage.multiRemove([...AUTH_ASYNC_STORAGE_KEYS, ...dynamicKeys]);
}
