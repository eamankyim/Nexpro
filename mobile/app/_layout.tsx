import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { useColorScheme } from '@/components/useColorScheme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

// Configure QueryClient with optimized defaults for mobile
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes by default (longer for mobile to reduce network calls)
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Keep cached data for 24 hours (allows offline access)
      gcTime: 24 * 60 * 60 * 1000, // 24 hours (formerly cacheTime)
      // Retry failed requests with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus (disabled for mobile - battery optimization)
      refetchOnWindowFocus: false,
      // Refetch on reconnect (enabled - good for mobile)
      refetchOnReconnect: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
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

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
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
          <CartProvider>
            <RootLayoutNav />
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

function RootLayoutNav() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const headerTint = '#166534';

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
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="account" options={{ ...innerScreenOptions, title: 'Account', headerShown: false }} />
        <Stack.Screen name="profile" options={{ ...innerScreenOptions, title: 'Profile', headerShown: false }} />
        <Stack.Screen name="settings" options={{ ...innerScreenOptions, title: 'Settings', headerShown: false }} />
        <Stack.Screen name="notifications" options={{ ...innerScreenOptions, title: 'Notifications', headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
