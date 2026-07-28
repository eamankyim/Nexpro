import { Stack } from 'expo-router';

import { StoreSetupProvider } from '@/context/StoreSetupContext';
import { useScreenColors } from '@/hooks/useScreenColors';

/**
 * Online Store first-run setup stack.
 * Welcome → confirm name → gap screens → products → go live.
 */
export default function StoreSetupLayout() {
  const { headerBg, textColor, colors } = useScreenColors();

  return (
    <StoreSetupProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          headerTintColor: colors.tint,
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { color: textColor },
          contentStyle: { backgroundColor: headerBg },
          // Snappy step hops — provider stays mounted; screens swap quickly.
          animation: 'fade',
          animationDuration: 150,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="confirm-name" />
        <Stack.Screen name="whatsapp" />
        <Stack.Screen name="logo" />
        <Stack.Screen name="color" />
        <Stack.Screen name="payments" />
        <Stack.Screen name="products" />
        <Stack.Screen name="go-live" />
      </Stack>
    </StoreSetupProvider>
  );
}
