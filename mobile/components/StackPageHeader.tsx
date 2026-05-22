import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { useScreenColors } from '@/hooks/useScreenColors';

type StackPageHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

/**
 * Custom top bar for stack screens (settings, profile, notifications) — matches tab header theme.
 */
export function StackPageHeader({ title, subtitle, right }: StackPageHeaderProps) {
  const insets = useSafeAreaInsets();
  const { headerBg, borderColor, textColor, mutedColor } = useScreenColors();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: headerBg,
          borderBottomColor: borderColor,
          paddingTop: insets.top > 0 ? insets.top : 12,
        },
      ]}
    >
      <View style={styles.row}>
        <BackButton />
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: mutedColor }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>{right ?? <View style={styles.rightPlaceholder} />}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
  },
  right: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  rightPlaceholder: { width: 40 },
});
