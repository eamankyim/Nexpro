import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { StoreSetupChrome } from '@/components/store/StoreSetupChrome';
import { useAuth } from '@/context/AuthContext';
import { useStoreSetup } from '@/context/StoreSetupContext';
import { useScreenColors } from '@/hooks/useScreenColors';
import { STORE_PRIMARY_FALLBACK } from '@/utils/onlineStoreDefaults';
import { BRAND_GREEN } from '@/constants/brand';
import { AppIcon } from '@/components/AppIcon';

const THEME_PRESETS = [
  { label: 'ABS Green', value: '#166534' },
  { label: 'Forest', value: '#14532d' },
  { label: 'Emerald', value: '#047857' },
  { label: 'Dark Green', value: '#064e3b' },
  { label: 'Sky', value: '#0369a1' },
  { label: 'Amber', value: '#b45309' },
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Slate', value: '#0f172a' },
];

/**
 * Step 4 — Brand color presets when org has no primary color. Skip → #166534.
 * Navigate first; color save runs in the background.
 */
export default function StoreSetupColorScreen() {
  const { hasFeature } = useAuth();
  const { textColor, mutedColor, borderColor } = useScreenColors();
  const { gapFlags, defaults, settings, persistSoftAndAdvance } = useStoreSetup();
  const [selected, setSelected] = useState(
    () => String(settings?.primaryColor || defaults.primaryColor || STORE_PRIMARY_FALLBACK)
  );

  const persistAndAdvance = useCallback(
    (color: string) => {
      persistSoftAndAdvance('color', { primaryColor: color }, { primaryColor: color });
    },
    [persistSoftAndAdvance]
  );

  const onContinue = useCallback(() => {
    persistAndAdvance(selected);
  }, [persistAndAdvance, selected]);

  const onSkip = useCallback(() => {
    persistAndAdvance(STORE_PRIMARY_FALLBACK);
  }, [persistAndAdvance]);

  if (!hasFeature('paymentsExpenses')) {
    return <FeatureAccessDenied message="Online store is not enabled for your workspace." />;
  }

  return (
    <StoreSetupChrome
      stepId="color"
      gapFlags={gapFlags}
      onSkip={onSkip}
      skipLabel="Skip"
      onContinue={onContinue}
    >
      <Text style={[styles.headline, { color: textColor }]}>Pick a brand color</Text>
      <Text style={[styles.body, { color: mutedColor }]}>
        Used for buttons and accents on your store. Skip to use ABS green.
      </Text>

      <View style={styles.grid}>
        {THEME_PRESETS.map((preset) => {
          const active = selected.toLowerCase() === preset.value.toLowerCase();
          return (
            <Pressable
              key={preset.value}
              onPress={() => setSelected(preset.value)}
              style={({ pressed }) => [
                styles.swatch,
                { borderColor: active ? BRAND_GREEN : borderColor },
                active && styles.swatchActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.dot, { backgroundColor: preset.value }]}>
                {active ? <AppIcon name="check" size={16} color="#fff" /> : null}
              </View>
              <Text style={[styles.swatchLabel, { color: textColor }]} numberOfLines={1}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </StoreSetupChrome>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: -4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatch: {
    width: '47%',
    flexGrow: 1,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swatchActive: {
    borderWidth: 2,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLabel: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  pressed: { opacity: 0.85 },
});
