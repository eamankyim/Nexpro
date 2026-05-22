import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import 'react-native-reanimated';
import { offlineQueueService } from '@/services/offlineQueueService';
import { refreshAfterSale } from '@/utils/queryInvalidation';
import { useQueryClient } from '@tanstack/react-query';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { AuthProvider } from '@/context/AuthContext';
import { ShopProvider } from '@/context/ShopContext';
import { StudioLocationProvider } from '@/context/StudioLocationContext';
import { CartProvider } from '@/context/CartContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

// Configure QueryClient with optimized defaults for mobile
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default stale window; transactional screens override with QUERY_STALE
      staleTime: 60 * 1000,
      // Keep cached data for 24 hours (allows offline access)
      gcTime: 24 * 60 * 60 * 1000, // 24 hours (formerly cacheTime)
      // Retry failed requests with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus (disabled for mobile - battery optimization)
      refetchOnWindowFocus: false,
      // Refetch on reconnect (enabled - good for mobile)
      refetchOnReconnect: true,
      // Refetch stale queries when returning to a screen (pairs with mutation invalidation)
      refetchOnMount: true,
      // Network mode: prefer cache, fallback to network
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Create AsyncStorage persister for offline cache
const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  // Only persist successful queries
  serialize: JSON.stringify,
  deserialize: JSON.parse,
  // Throttle persistence to avoid excessive writes
  throttleTime: 1000,
});

function OfflineSyncOnActive() {
  const queryClient = useQueryClient();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current === 'background' && nextState === 'active') {
        offlineQueueService
          .syncPendingSales()
          .then(({ synced }) => {
            if (synced > 0) return refreshAfterSale(queryClient);
          })
          .catch(() => {});
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [queryClient]);
  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        // Only persist queries that are marked as persistent
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        // Dehydrate options - only persist successful queries
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // Don't persist auth-related queries or mutations
            const queryKey = query.queryKey[0] as string;
            return (
              query.state.status === 'success' &&
              !queryKey.includes('auth') &&
              !queryKey.includes('login') &&
              !queryKey.includes('register')
            );
          },
        },
      }}
    >
      <ThemeProvider>
        <AuthProvider>
          <ShopProvider>
            <StudioLocationProvider>
              <CartProvider>
                <OfflineSyncOnActive />
                <RootLayoutNav />
              </CartProvider>
            </StudioLocationProvider>
          </ShopProvider>
        </AuthProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

function RootLayoutNav() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const headerTint = Colors[resolvedTheme ?? 'light'].tint;

  const innerScreenOptions = {
    headerShown: true,
    headerBackTitle: 'Back',
    headerBackVisible: true,
    headerTintColor: headerTint,
    headerStyle: {
      backgroundColor: isDark ? '#0f0f0f' : '#fff',
    },
    headerTitleStyle: {
      color: isDark ? '#fff' : '#000',
    },
  };

  return (
    <NavigationThemeProvider value={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="intro" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="account" options={{ ...innerScreenOptions, title: 'Account', headerShown: false }} />
        <Stack.Screen name="profile" options={{ ...innerScreenOptions, title: 'Profile', headerShown: false }} />
        <Stack.Screen name="settings" options={{ ...innerScreenOptions, title: 'Settings', headerShown: false }} />
        <Stack.Screen name="privacy-policy" options={{ ...innerScreenOptions, title: 'Privacy Policy', headerShown: false }} />
        <Stack.Screen name="data-deletion" options={{ ...innerScreenOptions, title: 'Data Deletion', headerShown: false }} />
        <Stack.Screen name="notifications" options={{ ...innerScreenOptions, title: 'Notifications', headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
