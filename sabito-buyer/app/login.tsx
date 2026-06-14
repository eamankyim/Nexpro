import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StorefrontGoogleSignInButton } from '@/components/StorefrontGoogleSignInButton';
import { PrimaryButton, Screen, SecondaryButton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { BRAND, STORAGE_KEYS } from '@/constants';
import { authApi } from '@/services/authApi';

type LoginMode = 'password' | 'otp';

export default function LoginScreen() {
  const { login, verifyOtp } = useAuth();
  const [mode, setMode] = useState<LoginMode>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const intent = await AsyncStorage.getItem(STORAGE_KEYS.checkoutIntent);
      if (intent) setMode('otp');
    })();
  }, []);

  const restoreIntent = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.onboardingComplete, 'true');
    const intent = await AsyncStorage.getItem(STORAGE_KEYS.checkoutIntent);
    await AsyncStorage.removeItem(STORAGE_KEYS.checkoutIntent);
    if (intent) {
      router.replace(intent as '/checkout');
      return;
    }
    router.replace('/(tabs)');
  };

  const onPasswordSubmit = async () => {
    setLoading(true);
    try {
      await login(email.trim(), password);
      await restoreIntent();
    } catch (err: unknown) {
      Alert.alert('Sign in failed', (err as { message?: string })?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const onSendOtp = async () => {
    setLoading(true);
    try {
      await authApi.sendLoginOtp(email.trim());
      setOtpSent(true);
      Alert.alert('Code sent', 'Check your email for a one-time login code.');
    } catch (err: unknown) {
      Alert.alert('Could not send code', (err as { message?: string })?.message || 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async () => {
    setLoading(true);
    try {
      await verifyOtp(email.trim(), otp.trim());
      await restoreIntent();
    } catch (err: unknown) {
      Alert.alert('Verification failed', (err as { message?: string })?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = (error: { message?: string; errorCode?: string; code?: string }, signUp = false) => {
    if (!signUp && (error.errorCode === 'GOOGLE_SHOPPER_NOT_FOUND' || error.code === 'GOOGLE_SHOPPER_NOT_FOUND')) {
      Alert.alert(
        'Create account with Google?',
        'No shopper account was found for that Google account.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign up with Google', onPress: () => router.replace('/signup') },
        ],
      );
      return;
    }
    Alert.alert('Google sign-in failed', error.message || 'Try again.');
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, mode === 'otp' && styles.tabActive]} onPress={() => setMode('otp')}>
          <Text style={[styles.tabText, mode === 'otp' && styles.tabTextActive]}>Email code</Text>
        </Pressable>
        <Pressable style={[styles.tab, mode === 'password' && styles.tabActive]} onPress={() => setMode('password')}>
          <Text style={[styles.tabText, mode === 'password' && styles.tabTextActive]}>Password</Text>
        </Pressable>
      </View>

      <StorefrontGoogleSignInButton
        label="Continue with Google"
        onSuccess={restoreIntent}
        onError={(error) => handleGoogleError(error, false)}
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {mode === 'password' ? (
        <>
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
          <View style={styles.actions}>
            <SecondaryButton label="Create account" onPress={() => router.replace('/signup')} />
            <PrimaryButton
              label="Sign in"
              onPress={onPasswordSubmit}
              loading={loading}
              disabled={!email.trim() || !password}
            />
          </View>
        </>
      ) : (
        <>
          {!otpSent ? (
            <View style={styles.actions}>
              <SecondaryButton label="Create account" onPress={() => router.replace('/signup')} />
              <PrimaryButton label="Send login code" onPress={onSendOtp} loading={loading} disabled={!email.trim()} />
            </View>
          ) : (
            <>
              <Text style={styles.label}>One-time code</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={otp} onChangeText={setOtp} />
              <View style={styles.actions}>
                <SecondaryButton label="Resend code" onPress={onSendOtp} />
                <SecondaryButton label="Create account" onPress={() => router.replace('/signup')} />
                <PrimaryButton label="Verify and continue" onPress={onVerifyOtp} loading={loading} disabled={!otp.trim()} />
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tabActive: { backgroundColor: BRAND.primary, borderColor: BRAND.primary },
  tabText: { fontWeight: '700', color: BRAND.text },
  tabTextActive: { color: '#fff' },
  label: { fontWeight: '600', color: BRAND.text, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  actions: { marginTop: 24, gap: 10 },
});
