import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';

import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { FormLabel, FormInput } from '@/components/FormField';
import { StoreSetupChrome } from '@/components/store/StoreSetupChrome';
import { useAuth } from '@/context/AuthContext';
import { useStoreSetup } from '@/context/StoreSetupContext';
import { useScreenColors } from '@/hooks/useScreenColors';

/**
 * Step 2 — WhatsApp when org has neither WhatsApp nor phone.
 * Navigate first; contact save runs in the background.
 */
export default function StoreSetupWhatsappScreen() {
  const { hasFeature } = useAuth();
  const { textColor, mutedColor } = useScreenColors();
  const { gapFlags, defaults, settings, persistSoftAndAdvance } = useStoreSetup();
  const [whatsapp, setWhatsapp] = useState(
    () =>
      String(settings?.whatsappNumber || settings?.contactPhone || defaults.whatsappNumber || defaults.contactPhone || '').trim()
  );

  const onContinue = useCallback(() => {
    const value = whatsapp.trim();
    if (!value) {
      Alert.alert('WhatsApp required', 'Add a WhatsApp number so customers can reach you.');
      return;
    }
    persistSoftAndAdvance(
      'whatsapp',
      { whatsappNumber: value, contactPhone: value },
      { whatsappNumber: value, contactPhone: value }
    );
  }, [persistSoftAndAdvance, whatsapp]);

  if (!hasFeature('paymentsExpenses')) {
    return <FeatureAccessDenied message="Online store is not enabled for your workspace." />;
  }

  return (
    <StoreSetupChrome
      stepId="whatsapp"
      gapFlags={gapFlags}
      onContinue={onContinue}
      continueDisabled={!whatsapp.trim()}
    >
      <Text style={[styles.headline, { color: textColor }]}>WhatsApp number</Text>
      <Text style={[styles.body, { color: mutedColor }]}>
        Customers use this to message you about orders. Ghana numbers work best (e.g. 024…).
      </Text>
      <View>
        <FormLabel>WhatsApp number</FormLabel>
        <FormInput
          value={whatsapp}
          onChangeText={setWhatsapp}
          placeholder="024 XXX XXXX"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
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
});
