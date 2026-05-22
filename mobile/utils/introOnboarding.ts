import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants';

/**
 * Whether the user has completed or skipped the marketing intro carousel.
 */
export async function hasCompletedIntroOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.INTRO_ONBOARDING_COMPLETED);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Persist intro carousel completion (skip or finish).
 */
export async function markIntroOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.INTRO_ONBOARDING_COMPLETED, 'true');
}
