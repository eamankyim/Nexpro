import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AppBrandLogo } from '@/components/AppBrandLogo';
import { router, Link } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { usePublicConfig } from '@/hooks/usePublicConfig';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { getErrorMessage } from '@/utils/errorMessages';
import { logger } from '@/utils/logger';
import { resetLocalSessionForOnboardingTest } from '@/utils/devSessionReset';
import { hasCompletedIntroOnboarding } from '@/utils/introOnboarding';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { FormInput, FormLabel } from '@/components/FormField';
import { useScreenColors } from '@/hooks/useScreenColors';
import { BRAND_GREEN } from '@/constants/brand';

const ERROR_MESSAGES = {
  EMPTY_FIELDS: 'Please enter your email and password.',
  DEFAULT: 'Login failed. Please try again.',
  GOOGLE_NOT_FOUND: 'No account found with this Google account. Sign up to create one.',
};

export default function LoginScreen() {
  const { colors, bg, textColor, mutedColor, borderColor } = useScreenColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingIntro, setCheckingIntro] = useState(true);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();
  const { login, googleAuth } = useAuth();
  const { googleClientId } = usePublicConfig();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const introDone = await hasCompletedIntroOnboarding();
      if (cancelled) return;
      if (!introDone) {
        router.replace('/intro');
        return;
      }
      setCheckingIntro(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleGoogleSuccess = async (idToken: string) => {
    setError('');
    await googleAuth(idToken, { signUp: false });
    logger.info('Login', 'Google sign-in success, navigating to index');
    router.replace('/');
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(ERROR_MESSAGES.EMPTY_FIELDS);
      return;
    }
    setError('');
    setLoading(true);
    logger.info('Login', 'Attempting login for:', email.trim());

    try {
      await login(email.trim(), password);
      logger.info('Login', 'Login success, navigating to index');
      router.replace('/');
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      const msg = code === 'GOOGLE_USER_NOT_FOUND' ? ERROR_MESSAGES.GOOGLE_NOT_FOUND : getErrorMessage(err, ERROR_MESSAGES.DEFAULT);
      setError(msg);
      logger.error('Login', 'Login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetOnboardingTestSession = async () => {
    try {
      await resetLocalSessionForOnboardingTest();
      queryClient.clear();
      Alert.alert('Reset complete', 'Local session and onboarding state were cleared.');
      router.replace('/');
    } catch (err) {
      Alert.alert('Reset failed', getErrorMessage(err, 'Could not clear local session.'));
    }
  };

  if (checkingIntro) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: bg }]}
    >
      <View style={styles.content}>
        <AppBrandLogo size={88} style={styles.logoWrap} />
        <Text style={[styles.title, { color: textColor }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: mutedColor }]}>Sign in to manage your business</Text>

        <FormLabel>Email</FormLabel>
        <FormInput
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

        <FormLabel>Password</FormLabel>
        <View style={[styles.inputWithIcon, { borderColor }]}>
          <TextInput
            style={[styles.inputInner, { color: textColor }]}
            placeholder="Enter your password"
            placeholderTextColor={mutedColor}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowPassword((prev) => !prev)}
            disabled={loading}
          >
            <AppIcon name={showPassword ? 'eye-off' : 'eye'} size={20} color={mutedColor} />
          </Pressable>
        </View>
        <View style={styles.forgotRow}>
          <Pressable onPress={() => router.push('/forgot-password')} disabled={loading}>
            <Text style={[styles.link, { color: colors.tint }]}>Forgot password?</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.tint },
            pressed && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        {googleClientId ? (
          <>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
            <GoogleSignInButton
              webClientId={googleClientId}
              mode="signin"
              onSuccess={handleGoogleSuccess}
              onError={setError}
              disabled={loading}
            />
          </>
        ) : null}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: mutedColor }]}>Don't have an account? </Text>
          <Link href="/signup" asChild>
            <Pressable disabled={loading}>
              <Text style={[styles.link, { color: colors.tint }]}>Create account</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.legalFooter}>
          <Pressable onPress={() => router.push('/privacy-policy')} disabled={loading}>
            <Text style={[styles.legalLink, { color: colors.tint }]}>Privacy Policy</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>•</Text>
          <Pressable onPress={() => router.push('/data-deletion')} disabled={loading}>
            <Text style={[styles.legalLink, { color: colors.tint }]}>Data Deletion</Text>
          </Pressable>
        </View>

        {__DEV__ ? (
          <Pressable
            onPress={handleResetOnboardingTestSession}
            disabled={loading}
            style={({ pressed }) => [styles.devResetButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.devResetText}>Reset onboarding test session</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    transform: [{ translateY: -24 }],
  },
  logoWrap: {
    marginBottom: 12,
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  inputWithIcon: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputInner: {
    flex: 1,
    fontSize: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 6,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: 4,
    marginBottom: 4,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
  },
  eyeButton: {
    paddingHorizontal: 10,
    height: 48,
    justifyContent: 'center',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    height: 48,
    backgroundColor: BRAND_GREEN,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  orLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  orText: { marginHorizontal: 12, fontSize: 14, color: '#6b7280' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 15,
    color: '#6b7280',
  },
  legalFooter: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  legalLink: {
    fontSize: 13,
    color: BRAND_GREEN,
    fontWeight: '600',
  },
  legalSeparator: {
    color: '#9ca3af',
    fontSize: 13,
  },
  link: {
    fontSize: 15,
    color: BRAND_GREEN,
    fontWeight: '600',
  },
  devResetButton: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  devResetText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
  },
});
