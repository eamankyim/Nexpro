import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';

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
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const muted = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';

  const onBack = useCallback(() => {
    router.replace('/(tabs)/more');
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FontAwesome name="lock" size={40} color={muted} style={styles.icon} />
      <Text style={[styles.title, { color: textColor }]}>Not available</Text>
      <Text style={[styles.body, { color: muted }]}>{message}</Text>
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
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 15, textAlign: 'center', marginBottom: 24, maxWidth: 320 },
  btn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});
