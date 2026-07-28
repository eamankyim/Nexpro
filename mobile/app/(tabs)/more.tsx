import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';

/**
 * More is opened as a bottom sheet from the tab bar.
 * Deep links to /(tabs)/more land here and bounce back to Home.
 */
export default function MoreScreen() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const tint = Colors[resolvedTheme ?? 'light'].tint;

  useEffect(() => {
    router.replace('/(tabs)/');
  }, [router]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
