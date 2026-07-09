import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { showError, showLoading, showSuccess } from '../utils/toast';
import { QUERY_CACHE } from '../constants';

const profileSchema = z.object({
  name: z.string().min(1, 'Enter your name'),
  email: z.string().email().optional(),
  profilePicture: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) return false;
  return true;
}, {
  message: 'Enter current password to set a new one',
  path: ['currentPassword'],
});

/**
 * Profile settings state and mutations (extracted from Settings.jsx).
 * @returns {Object}
 */
export const useSettingsProfile = () => {
  const queryClient = useQueryClient();
  const { updateUser, needsEmailVerification, isDriver, refreshAuthState } = useAuth();
  const savingToastDismissRef = useRef(null);

  const [profilePreview, setProfilePreview] = useState('');
  const [profileEditing, setProfileEditing] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [profilePreviewVisible, setProfilePreviewVisible] = useState(false);
  const [profileUploading, setProfileUploading] = useState(false);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      email: '',
      profilePicture: '',
      currentPassword: '',
      newPassword: '',
    },
  });

  const { data: profileData, isLoading: loadingProfile } = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: settingsService.getProfile,
    staleTime: QUERY_CACHE.STALE_TIME_VOLATILE,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (profileData?.data) {
      profileForm.reset({
        name: profileData.data.name || '',
        email: profileData.data.email || '',
        profilePicture: profileData.data.profilePicture || '',
      });
      setProfilePreview(profileData.data.profilePicture || '');
    }
  }, [profileData, profileForm]);

  const dismissSavingToast = useCallback(() => {
    if (savingToastDismissRef.current) {
      savingToastDismissRef.current();
      savingToastDismissRef.current = null;
    }
  }, []);

  const updateProfileMutation = useMutation({
    mutationFn: settingsService.updateProfile,
    onSuccess: (response) => {
      dismissSavingToast();
      showSuccess('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      if (response?.data) {
        profileForm.reset({
          name: response.data.name,
          email: response.data.email,
          profilePicture: response.data.profilePicture || '',
          currentPassword: '',
          newPassword: '',
        });
        setProfilePreview(response.data.profilePicture || '');
        updateUser(response.data);
        setProfileEditing(false);
        setShowChangePassword(false);
      }
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error, 'Failed to update profile. Please try again.');
    },
  });

  const onProfileSubmit = useCallback(async (values) => {
    const payload = {
      name: values.name,
      profilePicture: values.profilePicture || undefined,
    };
    if (values.newPassword) {
      payload.password = values.newPassword;
      payload.currentPassword = values.currentPassword;
    }
    savingToastDismissRef.current = showLoading('Saving...');
    updateProfileMutation.mutate(payload);
  }, [updateProfileMutation]);

  const handleProfileImageUpload = useCallback(async ({ file }) => {
    if (!file) return;
    setProfileUploading(true);
    try {
      const response = await settingsService.uploadProfilePicture(file);
      const updatedUser = response?.data?.data || response?.data || response;
      if (!updatedUser) throw new Error('Invalid response from server');
      const imageUrl = updatedUser.profilePicture || '';
      if (!imageUrl) throw new Error('Upload succeeded but no image URL returned');
      profileForm.setValue('profilePicture', imageUrl);
      setProfilePreview(imageUrl);
      updateUser(updatedUser);
      await refreshAuthState?.();
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
      showSuccess('Profile picture updated successfully');
    } catch (error) {
      const errMsg = error?.response?.data?.message || error?.message || 'Failed to upload profile picture';
      showError(error, errMsg);
    } finally {
      setProfileUploading(false);
    }
  }, [profileForm, queryClient, refreshAuthState, updateUser]);

  const cancelProfileEdit = useCallback(() => {
    if (profileData?.data) {
      profileForm.reset({
        name: profileData.data.name,
        email: profileData.data.email,
        profilePicture: profileData.data.profilePicture || '',
        currentPassword: '',
        newPassword: '',
      });
      setProfilePreview(profileData.data.profilePicture || '');
    }
    setShowChangePassword(false);
    setProfileEditing(false);
  }, [profileData, profileForm]);

  return {
    profileForm,
    profileData,
    loadingProfile,
    profilePreview,
    setProfilePreview,
    profileEditing,
    setProfileEditing,
    showChangePassword,
    setShowChangePassword,
    profilePreviewVisible,
    setProfilePreviewVisible,
    profileUploading,
    needsEmailVerification,
    isDriver,
    onProfileSubmit,
    handleProfileImageUpload,
    cancelProfileEdit,
    updateProfileMutation,
  };
};

export { profileSchema };
