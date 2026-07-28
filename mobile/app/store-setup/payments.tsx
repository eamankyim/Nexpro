import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';

import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { FormLabel, FormInput } from '@/components/FormField';
import { StoreSetupChrome } from '@/components/store/StoreSetupChrome';
import { useAuth } from '@/context/AuthContext';
import { useStoreSetup } from '@/context/StoreSetupContext';
import { useScreenColors } from '@/hooks/useScreenColors';
import { settingsService } from '@/services/settings';
import { getErrorMessage } from '@/utils/errorMessages';
import {
  DIRECT_MOMO_PROVIDERS,
  isValidDirectMomoPhone,
  normalizeDirectMomoPhone,
  type DirectMomoProvider,
} from '@/utils/paymentCollection';
import { BRAND_GREEN } from '@/constants/brand';

/**
 * Step 5 — Thin MoMo payment-collection connect when not already configured.
 */
export default function StoreSetupPaymentsScreen() {
  const { hasFeature, user } = useAuth();
  const { textColor, mutedColor, borderColor } = useScreenColors();
  const {
    gapFlags,
    defaults,
    organization,
    paymentConfigured,
    buildSmartDefaultsPayload,
    saveSettings,
    setPaymentCollectionLocal,
    advanceFrom,
  } = useStoreSetup();

  const [businessName, setBusinessName] = useState(
    () => defaults.displayName || String(organization?.name || '')
  );
  const [momoPhone, setMomoPhone] = useState(() => defaults.contactPhone || defaults.whatsappNumber || '');
  const [provider, setProvider] = useState<DirectMomoProvider>('MTN');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [useOtp, setUseOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const canSubmit = useMemo(() => {
    if (!businessName.trim()) return false;
    if (!isValidDirectMomoPhone(momoPhone)) return false;
    if (useOtp) return otp.trim().length >= 6;
    return password.trim().length > 0;
  }, [businessName, momoPhone, otp, password, useOtp]);

  const sendOtp = useCallback(async () => {
    setSendingOtp(true);
    try {
      await settingsService.sendPaymentCollectionOtp();
      setOtpSent(true);
      setUseOtp(true);
      Alert.alert('Code sent', 'Check your email for a verification code.');
    } catch (error) {
      Alert.alert(
        'Could not send code',
        getErrorMessage(error, 'Email verification is only available for Google sign-in accounts. Use your password instead.')
      );
      setUseOtp(false);
    } finally {
      setSendingOtp(false);
    }
  }, []);

  const onContinue = useCallback(async () => {
    if (paymentConfigured) {
      advanceFrom('payments');
      return;
    }

    const phone = normalizeDirectMomoPhone(momoPhone);
    if (!businessName.trim()) {
      Alert.alert('Name required', 'Enter the business name for payouts.');
      return;
    }
    if (!isValidDirectMomoPhone(momoPhone)) {
      Alert.alert('Invalid number', 'Enter a valid Ghana MoMo number (e.g. 024XXXXXXX).');
      return;
    }
    if (!useOtp && !password.trim()) {
      Alert.alert('Password required', 'Confirm with your account password to connect MoMo.');
      return;
    }
    if (useOtp && otp.trim().length < 6) {
      Alert.alert('Code required', 'Enter the 6-digit code from your email.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        settlement_type: 'momo',
        business_name: businessName.trim(),
        momo_phone: phone,
        momo_provider: provider === 'VODAFONE' ? 'TELECEL' : provider,
        primary_contact_email: defaults.contactEmail || user?.email || undefined,
      };
      if (useOtp) {
        payload.otp = otp.trim();
      } else {
        payload.password = password;
      }

      const updated = await settingsService.updatePaymentCollectionSettings(payload);
      setPaymentCollectionLocal(updated);

      // Soft-sync store payment metadata; do not block Continue on status refresh.
      void (async () => {
        try {
          const storePayload = await buildSmartDefaultsPayload({ forcePaymentConfigured: true });
          await saveSettings(storePayload);
        } catch {
          // Payment connected; store metadata sync can retry on go-live
        }
      })();

      advanceFrom('payments');
    } catch (error) {
      const message = getErrorMessage(error, 'Could not connect Mobile Money.');
      if (/google|otp|verification code/i.test(message) && !useOtp) {
        setUseOtp(true);
        Alert.alert('Use email code', 'This account needs an email verification code instead of a password.');
      } else {
        Alert.alert('Could not connect', message);
      }
    } finally {
      setSaving(false);
    }
  }, [
    advanceFrom,
    buildSmartDefaultsPayload,
    businessName,
    defaults.contactEmail,
    momoPhone,
    otp,
    password,
    paymentConfigured,
    provider,
    saveSettings,
    setPaymentCollectionLocal,
    useOtp,
    user?.email,
  ]);

  if (!hasFeature('paymentsExpenses')) {
    return <FeatureAccessDenied message="Online store is not enabled for your workspace." />;
  }

  if (paymentConfigured) {
    return (
      <StoreSetupChrome
        stepId="payments"
        gapFlags={gapFlags}
        onContinue={() => advanceFrom('payments')}
        continueLabel="Continue"
      >
        <Text style={[styles.headline, { color: textColor }]}>Payments ready</Text>
        <Text style={[styles.body, { color: mutedColor }]}>
          Your payout destination is already connected. Online store checkout can collect MoMo and card.
        </Text>
      </StoreSetupChrome>
    );
  }

  return (
    <StoreSetupChrome
      stepId="payments"
      gapFlags={gapFlags}
      onContinue={onContinue}
      continueLabel="Connect MoMo"
      continueDisabled={!canSubmit}
      continuing={saving}
    >
      <Text style={[styles.headline, { color: textColor }]}>Get paid</Text>
      <Text style={[styles.body, { color: mutedColor }]}>
        Connect Mobile Money so customers can pay you online. Settlements go to this wallet in GHS.
      </Text>

      <View>
        <FormLabel>Business / account name</FormLabel>
        <FormInput
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Name on MoMo wallet"
          autoCapitalize="words"
        />
      </View>

      <View>
        <FormLabel>MoMo number</FormLabel>
        <FormInput
          value={momoPhone}
          onChangeText={setMomoPhone}
          placeholder="024 XXX XXXX"
          keyboardType="phone-pad"
        />
      </View>

      <Text style={[styles.sectionLabel, { color: mutedColor }]}>Network</Text>
      <View style={styles.providerRow}>
        {DIRECT_MOMO_PROVIDERS.map((item) => {
          const active = provider === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setProvider(item.value)}
              style={({ pressed }) => [
                styles.providerChip,
                { borderColor: active ? BRAND_GREEN : borderColor },
                active && styles.providerActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.providerLabel, { color: textColor }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!useOtp ? (
        <View>
          <FormLabel>Account password</FormLabel>
          <FormInput
            value={password}
            onChangeText={setPassword}
            placeholder="Confirm with your password"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
          />
          <Pressable
            onPress={() => {
              void sendOtp();
            }}
            disabled={sendingOtp}
            style={styles.altLink}
          >
            <Text style={{ color: BRAND_GREEN, fontWeight: '600' }}>
              {sendingOtp ? 'Sending code…' : 'Use email verification code instead'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <FormLabel>Email verification code</FormLabel>
          <FormInput
            value={otp}
            onChangeText={setOtp}
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={8}
          />
          <Pressable
            onPress={() => {
              void sendOtp();
            }}
            disabled={sendingOtp}
            style={styles.altLink}
          >
            <Text style={{ color: BRAND_GREEN, fontWeight: '600' }}>
              {otpSent ? 'Resend code' : sendingOtp ? 'Sending…' : 'Send code'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setUseOtp(false)} style={styles.altLink}>
            <Text style={{ color: mutedColor, fontWeight: '500' }}>Use password instead</Text>
          </Pressable>
        </View>
      )}
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
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: -4,
  },
  providerRow: {
    gap: 8,
  },
  providerChip: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  providerActive: {
    borderWidth: 2,
  },
  providerLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  altLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});
