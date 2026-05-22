import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import { AppIcon } from '@/components/AppIcon';
import { useScreenColors } from '@/hooks/useScreenColors';

type Props = {
  message?: string;
};

/**
 * Shown when the active tenant does not have a feature flag (same gating as web FeatureRoute).
 */
export function FeatureAccessDenied({
  message = 'This feature is not enabled for your workspace.',
}: Props) {
  const router = useRouter();
  const { colors, bg, textColor, mutedColor, borderColor } = useScreenColors();

  const onBack = useCallback(() => {
    router.replace('/(tabs)/more');
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <AppIcon name="lock" size={40} color={mutedColor} style={styles.icon} />
      <Text style={[styles.title, { color: textColor }]}>Not available</Text>
      <Text style={[styles.body, { color: mutedColor }]}>{message}</Text>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.btn, { borderColor, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={{ color: colors.tint, fontWeight: '700' }}>Back to menu</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 15, textAlign: 'center', marginBottom: 24, maxWidth: 320 },
  btn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});
