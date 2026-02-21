import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { settingsService } from '@/services/settings';
import { resolveImageUrl } from '@/utils/fileUtils';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { logger } from '@/utils/logger';
import { BackButton } from '@/components/BackButton';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await settingsService.updateProfile({ name: name.trim() || undefined });
      logger.info('Profile', 'Profile updated');
      router.back();
    } catch (err) {
      logger.error('Profile', 'Update failed:', err);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [name, router]);

  const bg = colorScheme === 'dark' ? colors.background : '#fff';
  const cardBg = colorScheme === 'dark' ? '#27272a' : '#f9fafb';
  const borderColor = colorScheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = colorScheme === 'dark' ? '#fff' : '#111';
  const mutedColor = colorScheme === 'dark' ? '#a1a1aa' : '#6b7280';

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header with back button */}
        <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 12 }]}>
          <BackButton />
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            {user?.profilePicture ? (
              <Image
                source={{ uri: resolveImageUrl(user.profilePicture) }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.tint }]}>
                <FontAwesome name="user" size={40} color="#fff" />
              </View>
            )}
          </View>

          {/* Basic settings */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.label, { color: mutedColor }]}>Name</Text>
            <TextInput
              style={[styles.input, { color: textColor, borderColor }]}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={mutedColor}
              autoCapitalize="words"
            />
            <Text style={[styles.label, { color: mutedColor, marginTop: 16 }]}>Email</Text>
            <TextInput
              style={[styles.input, { color: mutedColor, borderColor }]}
              value={email}
              editable={false}
              placeholder="Email"
              placeholderTextColor={mutedColor}
            />
            <Text style={[styles.hint, { color: mutedColor }]}>
              Email cannot be changed here.
            </Text>
          </View>

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.tint },
              pressed && styles.buttonPressed,
              saving && styles.buttonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Save changes</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
  },
  primaryButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
