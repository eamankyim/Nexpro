import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { useScreenColors } from '@/hooks/useScreenColors';

type ListLoadingStateProps = {
  message?: string;
};

export function ListLoadingState({ message = 'Loading...' }: ListLoadingStateProps) {
  const { colors, mutedColor } = useScreenColors();

  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={colors.tint} />
      <Text style={[styles.loadingText, { color: mutedColor }]}>{message}</Text>
    </View>
  );
}

type ListErrorStateProps = {
  title?: string;
  message: string;
  onRetry: () => void;
};

export function ListErrorState({
  title = 'Failed to load',
  message,
  onRetry,
}: ListErrorStateProps) {
  const { colors, textColor, mutedColor, danger } = useScreenColors();

  const displayMessage = message.includes('timeout')
    ? 'Request timed out. Please check your connection and try again.'
    : message;

  return (
    <View style={styles.center}>
      <AppIcon name="exclamation-triangle" size={48} color={danger} />
      <Text style={[styles.title, { color: textColor }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: mutedColor }]}>{displayMessage}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading this list"
        style={[styles.retryBtn, { backgroundColor: colors.tint }]}
      >
        <Text style={styles.retryBtnText}>Retry</Text>
      </Pressable>
    </View>
  );
}

type ListSkeletonStateProps = {
  rows?: number;
  message?: string;
};

export function ListSkeletonState({ rows = 5, message = 'Loading content...' }: ListSkeletonStateProps) {
  const { cardBg, borderColor } = useScreenColors();

  return (
    <View
      style={styles.skeletonWrap}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={[styles.skeletonCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.skeletonHeader}>
            <View style={[styles.skeletonAvatar, styles.skeletonBlock]} />
            <View style={styles.skeletonLines}>
              <View style={[styles.skeletonLineWide, styles.skeletonBlock]} />
              <View style={[styles.skeletonLineShort, styles.skeletonBlock]} />
            </View>
          </View>
          <View style={[styles.skeletonLineFull, styles.skeletonBlock]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: 200,
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  title: { fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
    maxWidth: 320,
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skeletonWrap: { padding: 16, gap: 12 },
  skeletonCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 22 },
  skeletonLines: { flex: 1, gap: 8 },
  skeletonBlock: { backgroundColor: '#e5e7eb' },
  skeletonLineWide: { height: 14, borderRadius: 7, width: '76%' },
  skeletonLineShort: { height: 12, borderRadius: 6, width: '48%' },
  skeletonLineFull: { height: 12, borderRadius: 6, width: '100%', opacity: 0.75 },
});
