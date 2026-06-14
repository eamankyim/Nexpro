import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { BRAND } from '@/constants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 2, refetchOnWindowFocus: false },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#fff' },
              headerTintColor: BRAND.primary,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: BRAND.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding/address" options={{ title: 'Delivery setup' }} />
            <Stack.Screen name="search" options={{ title: 'Search' }} />
            <Stack.Screen name="cart" options={{ title: 'Cart' }} />
            <Stack.Screen name="account" options={{ title: 'Account' }} />
            <Stack.Screen name="login" options={{ title: 'Sign in' }} />
            <Stack.Screen name="signup" options={{ title: 'Create account' }} />
            <Stack.Screen name="signup-password" options={{ title: 'Password setup' }} />
            <Stack.Screen name="product/[id]" options={{ title: 'Product' }} />
            <Stack.Screen name="store/[slug]" options={{ title: 'Store' }} />
            <Stack.Screen name="studio/[slug]" options={{ title: 'Studio' }} />
            <Stack.Screen name="service/[studioSlug]/[serviceSlug]" options={{ title: 'Service' }} />
            <Stack.Screen name="service/booking/paystack" options={{ title: 'Service payment', presentation: 'modal' }} />
            <Stack.Screen name="service/booking/success/[id]" options={{ title: 'Booking confirmed', headerBackVisible: false }} />
            <Stack.Screen name="checkout/index" options={{ title: 'Checkout' }} />
            <Stack.Screen name="checkout/paystack" options={{ title: 'Payment', presentation: 'modal' }} />
            <Stack.Screen name="checkout/success/[id]" options={{ title: 'Order placed', headerBackVisible: false }} />
            <Stack.Screen name="order/[id]" options={{ title: 'Order details' }} />
            <Stack.Screen name="booking/[id]" options={{ title: 'Booking details' }} />
            <Stack.Screen name="track-order" options={{ title: 'Track order' }} />
            <Stack.Screen name="wishlist" options={{ title: 'Wishlist' }} />
            <Stack.Screen name="addresses" options={{ title: 'Addresses' }} />
            <Stack.Screen name="profile" options={{ title: 'Profile' }} />
            <Stack.Screen name="verify-email" options={{ title: 'Verify email' }} />
            <Stack.Screen name="disputes" options={{ title: 'Issues' }} />
            <Stack.Screen name="notifications-settings" options={{ title: 'Notifications' }} />
          </Stack>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
