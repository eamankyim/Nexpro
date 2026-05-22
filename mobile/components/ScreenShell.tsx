import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type RefreshControlProps,
} from 'react-native';

import { useScreenColors } from '@/hooks/useScreenColors';

type ScreenShellProps = {
  children: React.ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Extra bottom padding for tab bar / safe area */
  bottomPadding?: number;
};

/**
 * Standard screen wrapper: background, optional scroll, consistent padding.
 */
export function ScreenShell({
  children,
  scrollable = false,
  contentContainerStyle,
  style,
  refreshControl,
  bottomPadding = 32,
}: ScreenShellProps) {
  const { bg } = useScreenColors();

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.flex, { backgroundColor: bg }, style]}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: bg }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: 16 },
});
