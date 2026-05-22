import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

import { useScreenColors } from '@/hooks/useScreenColors';

export type FilterOption = {
  value: string;
  label: string;
};

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

/** Solid green active state — standard filter pill across list screens. */
export function FilterChip({ label, active, onPress }: FilterChipProps) {
  const { colors, borderColor, textColor } = useScreenColors();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor },
        active && { backgroundColor: colors.tint, borderColor: colors.tint },
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, { color: active ? '#fff' : textColor }]}>{label}</Text>
    </Pressable>
  );
}

type FilterChipRowProps = {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  /** Capitalize first letter of label when formatting from value */
  formatLabel?: (value: string, label: string) => string;
};

export function FilterChipRow({ options, value, onChange, formatLabel }: FilterChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => (
        <FilterChip
          key={opt.value}
          label={formatLabel ? formatLabel(opt.value, opt.label) : opt.label}
          active={value === opt.value}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /** Prevent flex parent from giving this row full screen height (stretched vertical chips). */
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 52,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
  },
  chip: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
