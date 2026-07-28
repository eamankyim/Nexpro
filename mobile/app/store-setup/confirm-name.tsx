import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';

import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { FormLabel, FormInput } from '@/components/FormField';
import { StoreSetupChrome } from '@/components/store/StoreSetupChrome';
import { useAuth } from '@/context/AuthContext';
import { useStoreSetup } from '@/context/StoreSetupContext';
import { useScreenColors } from '@/hooks/useScreenColors';
import { getErrorMessage } from '@/utils/errorMessages';

/**
 * Step 1 — Confirm store display name; silent smart defaults on first save
 * (copies business logo into store logoUrl when store logo is empty).
 */
export default function StoreSetupConfirmNameScreen() {
  const { hasFeature } = useAuth();
  const { textColor, mutedColor } = useScreenColors();
  const {
    loading,
    defaults,
    settings,
    gapFlags,
    resolveAvailableSlug,
    buildSmartDefaultsPayload,
    saveSettings,
    advanceFrom,
  } = useStoreSetup();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fromSettings = String(settings?.displayName || '').trim();
    const fromDefaults = String(defaults.displayName || '').trim();
    setName((prev) => prev || fromSettings || fromDefaults);
  }, [defaults.displayName, settings?.displayName]);

  // Keep slug warm while the merchant edits the name.
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const timer = setTimeout(() => {
      void resolveAvailableSlug(trimmed);
    }, 350);
    return () => clearTimeout(timer);
  }, [name, resolveAvailableSlug]);

  const onContinue = useCallback(async () => {
    const displayName = name.trim();
    if (!displayName) {
      Alert.alert('Store name required', 'Enter a name customers will see on your store.');
      return;
    }
    setSaving(true);
    try {
      // Warm slug from cache/prefetch, then block only on the required PUT.
      // setup-status refresh inside saveSettings is fire-and-forget.
      void resolveAvailableSlug(displayName);
      const payload = await buildSmartDefaultsPayload({ displayName });
      await saveSettings(payload);
      advanceFrom('confirm-name');
    } catch (error) {
      Alert.alert('Could not save', getErrorMessage(error, 'Failed to save store name.'));
    } finally {
      setSaving(false);
    }
  }, [advanceFrom, buildSmartDefaultsPayload, name, resolveAvailableSlug, saveSettings]);

  if (!hasFeature('paymentsExpenses')) {
    return <FeatureAccessDenied message="Online store is not enabled for your workspace." />;
  }

  // Only block on first paint when we have no tenant default name yet.
  if (loading && !name && !defaults.displayName) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <StoreSetupChrome
      stepId="confirm-name"
      gapFlags={gapFlags}
      onContinue={onContinue}
      continueLabel="Continue"
      continueDisabled={!name.trim()}
      continuing={saving}
    >
      <Text style={[styles.headline, { color: textColor }]}>Confirm store name</Text>
      <Text style={[styles.body, { color: mutedColor }]}>
        Customers see this on your online store. You can change it later.
      </Text>
      <View>
        <FormLabel>Store name</FormLabel>
        <FormInput
          value={name}
          onChangeText={setName}
          placeholder="Your store name"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => {
            void onContinue();
          }}
        />
      </View>
    </StoreSetupChrome>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
});
