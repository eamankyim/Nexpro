import React, { useCallback, useEffect, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { AppIcon } from '@/components/AppIcon';
import { useAuth } from '@/context/AuthContext';
import { settingsService } from '@/services/settings';
import { resolveImageUrl } from '@/utils/fileUtils';
import { getErrorMessage } from '@/utils/errorMessages';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { StackPageHeader } from '@/components/StackPageHeader';
import { logger } from '@/utils/logger';

type ProfileData = {
  name?: string;
  email?: string;
  profilePicture?: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, refreshAuth } = useAuth();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor, inputBg } = useScreenColors();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profilePreview, setProfilePreview] = useState(user?.profilePicture ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: profileRes, isLoading: profileLoading } = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: () => settingsService.getProfile(),
  });

  const profileData: ProfileData | undefined = profileRes?.data ?? profileRes;

  useEffect(() => {
    if (!profileData) return;
    setName(profileData.name ?? '');
    setEmail(profileData.email ?? user?.email ?? '');
    setProfilePreview(profileData.profilePicture ?? user?.profilePicture ?? '');
  }, [profileData, user?.email, user?.profilePicture]);

  const resetForm = useCallback(() => {
    setName(profileData?.name ?? user?.name ?? '');
    setEmail(profileData?.email ?? user?.email ?? '');
    setProfilePreview(profileData?.profilePicture ?? user?.profilePicture ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setShowChangePassword(false);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  }, [profileData, user?.email, user?.name, user?.profilePicture]);

  const handleToggleEdit = useCallback(() => {
    if (editing) {
      resetForm();
      setEditing(false);
      return;
    }
    setEditing(true);
  }, [editing, resetForm]);

  const handlePickPhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to upload a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]?.uri) return;

      const asset = result.assets[0];
      setUploadingPhoto(true);
      const response = await settingsService.uploadProfilePicture(
        asset.uri,
        asset.mimeType ?? 'image/jpeg'
      );
      const updatedUser = response?.data ?? response;
      const imageUrl = updatedUser?.profilePicture ?? '';
      if (!imageUrl) {
        throw new Error('Upload succeeded but no image was returned');
      }
      setProfilePreview(imageUrl);
      await refreshAuth();
      logger.info('Profile', 'Profile picture updated');
      Alert.alert('Saved', 'Profile picture updated.');
    } catch (err) {
      logger.error('Profile', 'Photo upload failed:', err);
      Alert.alert('Upload failed', getErrorMessage(err, 'Could not upload profile picture.'));
    } finally {
      setUploadingPhoto(false);
    }
  }, [refreshAuth]);

  const handleRemovePhoto = useCallback(async () => {
    setUploadingPhoto(true);
    try {
      await settingsService.updateProfile({ profilePicture: '' });
      setProfilePreview('');
      await refreshAuth();
      Alert.alert('Removed', 'Profile picture removed.');
    } catch (err) {
      logger.error('Profile', 'Remove photo failed:', err);
      Alert.alert('Error', getErrorMessage(err, 'Could not remove profile picture.'));
    } finally {
      setUploadingPhoto(false);
    }
  }, [refreshAuth]);

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Enter your full name.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters for your new password.');
      return;
    }

    if (newPassword && !currentPassword.trim()) {
      Alert.alert('Current password required', 'Enter your current password to set a new one.');
      return;
    }

    setSaving(true);
    try {
      const payload: Parameters<typeof settingsService.updateProfile>[0] = {
        name: trimmedName,
      };
      if (newPassword) {
        payload.password = newPassword;
        payload.currentPassword = currentPassword;
      }

      await settingsService.updateProfile(payload);
      await refreshAuth();
      setCurrentPassword('');
      setNewPassword('');
      setShowChangePassword(false);
      setEditing(false);
      logger.info('Profile', 'Profile updated');
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err) {
      logger.error('Profile', 'Update failed:', err);
      Alert.alert('Error', getErrorMessage(err, 'Failed to update profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  }, [name, newPassword, currentPassword, refreshAuth]);

  const handleResetPassword = useCallback(() => {
    const accountEmail = email.trim() || user?.email || '';
    router.push({
      pathname: '/forgot-password',
      params: accountEmail ? { email: accountEmail } : undefined,
    });
  }, [email, router, user?.email]);

  const inputDisabledBg = inputBg;

  return (
    <ScreenShell style={styles.container}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StackPageHeader
        title="Profile"
        right={
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleToggleEdit}
              disabled={saving || uploadingPhoto}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: textColor }]}>
                {editing ? 'Cancel' : 'Edit'}
              </Text>
            </Pressable>
            {editing ? (
              <Pressable
                onPress={handleSave}
                disabled={saving || uploadingPhoto}
                style={({ pressed }) => [
                  styles.primaryButtonSmall,
                  { backgroundColor: colors.tint },
                  pressed && styles.buttonPressed,
                  (saving || uploadingPhoto) && styles.buttonDisabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonSmallText}>Save</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {profileLoading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color={colors.tint} />
        ) : null}

        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            {profilePreview ? (
              <Image source={{ uri: resolveImageUrl(profilePreview) }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.tint }]}>
                <AppIcon name="user" size={40} color="#fff" />
              </View>
            )}
            {editing ? (
              <Pressable
                onPress={handlePickPhoto}
                disabled={uploadingPhoto}
                style={[styles.cameraButton, { backgroundColor: colors.tint, borderColor: bg }]}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <AppIcon name="camera" size={16} color="#fff" />
                )}
              </Pressable>
            ) : null}
          </View>
          {editing && profilePreview ? (
            <Pressable
              onPress={handleRemovePhoto}
              disabled={uploadingPhoto}
              style={({ pressed }) => [styles.removePhotoBtn, pressed && styles.buttonPressed]}
            >
              <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 14 }}>Remove photo</Text>
            </Pressable>
          ) : null}
          {!profilePreview && editing ? (
            <Text style={[styles.hint, { color: mutedColor, textAlign: 'center' }]}>
              Tap the camera icon to upload a profile picture.
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Personal information</Text>
          <Text style={[styles.label, { color: mutedColor }]}>Full name</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: textColor,
                borderColor,
                backgroundColor: editing ? cardBg : inputDisabledBg,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={mutedColor}
            autoCapitalize="words"
            editable={editing && !saving}
          />
          <Text style={[styles.label, { color: mutedColor, marginTop: 16 }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: mutedColor,
                borderColor,
                backgroundColor: inputDisabledBg,
              },
            ]}
            value={email}
            editable={false}
            placeholder="Email"
            placeholderTextColor={mutedColor}
          />
          <Text style={[styles.hint, { color: mutedColor }]}>
            Email cannot be changed here.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Change password</Text>
          {!showChangePassword ? (
            <Pressable
              onPress={() => {
                setShowChangePassword(true);
                if (!editing) setEditing(true);
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor, alignSelf: 'flex-start' },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: textColor }]}>Change password</Text>
            </Pressable>
          ) : (
            <View style={styles.passwordFields}>
              <Text style={[styles.label, { color: mutedColor }]}>Current password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { color: textColor, borderColor, backgroundColor: cardBg },
                  ]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={mutedColor}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                  editable={editing && !saving}
                />
                <Pressable
                  onPress={() => setShowCurrentPassword((v) => !v)}
                  style={styles.eyeButton}
                  hitSlop={8}
                >
                  <AppIcon name={showCurrentPassword ? 'eye-off' : 'eye'} size={18} color={mutedColor} />
                </Pressable>
              </View>

              <Text style={[styles.label, { color: mutedColor, marginTop: 16 }]}>New password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { color: textColor, borderColor, backgroundColor: cardBg },
                  ]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={mutedColor}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  editable={editing && !saving}
                />
                <Pressable
                  onPress={() => setShowNewPassword((v) => !v)}
                  style={styles.eyeButton}
                  hitSlop={8}
                >
                  <AppIcon name={showNewPassword ? 'eye-off' : 'eye'} size={18} color={mutedColor} />
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  setShowChangePassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                }}
                style={({ pressed }) => [styles.cancelPasswordBtn, pressed && styles.buttonPressed]}
              >
                <Text style={{ color: mutedColor, fontWeight: '600' }}>Cancel password change</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={handleResetPassword}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor, marginTop: 16, alignSelf: 'flex-start' },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: textColor }]}>Reset password via email</Text>
          </Pressable>
          <Text style={[styles.hint, { color: mutedColor, marginTop: 8 }]}>
            We'll email you a link if you forgot your current password.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  removePhotoBtn: { marginTop: 12, paddingVertical: 4 },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordFields: { gap: 0 },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 44 },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  cancelPasswordBtn: { marginTop: 12, alignSelf: 'flex-start', paddingVertical: 4 },
  hint: { fontSize: 12, marginTop: 6 },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },
  primaryButtonSmall: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  primaryButtonSmallText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.6 },
});
