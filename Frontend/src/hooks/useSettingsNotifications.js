import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import authService from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { showError, showSuccess } from '../utils/toast';
import { NOTIFICATION_PREFERENCE_LOCKED_CHANNELS, QUERY_CACHE } from '../constants';

/**
 * Staff notification preferences (in-app bell + email copy).
 * @returns {Object}
 */
export const useSettingsNotifications = () => {
  const queryClient = useQueryClient();
  const { user, refreshAuthState } = useAuth();
  const [notificationPrefsDraft, setNotificationPrefsDraft] = useState(null);

  const { data: profileData, isLoading: loadingProfile } = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: settingsService.getProfile,
    staleTime: QUERY_CACHE.STALE_TIME_VOLATILE,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const prefs = profileData?.data?.notificationPreferences;
    if (prefs?.categories) {
      setNotificationPrefsDraft({
        categories: JSON.parse(JSON.stringify(prefs.categories)),
      });
    }
  }, [profileData]);

  const updateNotificationPrefsMutation = useMutation({
    mutationFn: (categories) => authService.updateNotificationPreferences(categories),
    onSuccess: (body) => {
      showSuccess('Notification preferences saved');
      if (body?.data?.categories) {
        setNotificationPrefsDraft({
          categories: JSON.parse(JSON.stringify(body.data.categories)),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      refreshAuthState();
    },
    onError: (error) => {
      showError(error, 'Failed to save notification preferences.');
    },
  });

  const setNotifChannel = useCallback((categoryKey, channel, value) => {
    const lock = NOTIFICATION_PREFERENCE_LOCKED_CHANNELS[categoryKey]?.[channel];
    if (lock) return;
    setNotificationPrefsDraft((prev) => {
      if (!prev?.categories?.[categoryKey]) return prev;
      return {
        categories: {
          ...prev.categories,
          [categoryKey]: {
            ...prev.categories[categoryKey],
            [channel]: value,
          },
        },
      };
    });
  }, []);

  const resetNotificationPrefs = useCallback(() => {
    const prefs = profileData?.data?.notificationPreferences;
    if (prefs?.categories) {
      setNotificationPrefsDraft({
        categories: JSON.parse(JSON.stringify(prefs.categories)),
      });
    }
  }, [profileData]);

  const saveNotificationPrefs = useCallback(() => {
    if (notificationPrefsDraft?.categories) {
      updateNotificationPrefsMutation.mutate(notificationPrefsDraft.categories);
    }
  }, [notificationPrefsDraft, updateNotificationPrefsMutation]);

  return {
    user,
    loadingProfile,
    notificationPrefsDraft,
    updateNotificationPrefsMutation,
    setNotifChannel,
    resetNotificationPrefs,
    saveNotificationPrefs,
  };
};
