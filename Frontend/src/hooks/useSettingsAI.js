import { useRef, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { showError, showLoading, showSuccess } from '../utils/toast';
import { QUERY_CACHE } from '../constants';

/**
 * Workspace Anthropic API key settings.
 * @returns {Object}
 */
export const useSettingsAI = () => {
  const queryClient = useQueryClient();
  const { activeTenant, isManager } = useAuth();
  const canManageOrganization = Boolean(isManager);
  const savingToastDismissRef = useRef(null);
  const [aiApiKey, setAiApiKey] = useState('');
  const [showAiApiKey, setShowAiApiKey] = useState(false);

  const dismissSavingToast = useCallback(() => {
    if (savingToastDismissRef.current) {
      savingToastDismissRef.current();
      savingToastDismissRef.current = null;
    }
  }, []);

  const { data: aiSettingsData, isLoading: loadingAISettings } = useQuery({
    queryKey: ['settings', 'ai', activeTenant?.id],
    queryFn: settingsService.getAISettings,
    enabled: canManageOrganization && !!activeTenant?.id,
    staleTime: QUERY_CACHE.STALE_TIME_DEFAULT,
  });

  const aiSettings = aiSettingsData || {};
  const aiSourceText = aiSettings.source === 'tenant'
    ? 'Workspace key'
    : aiSettings.source === 'system'
      ? 'System default'
      : 'None';

  const updateAISettingsMutation = useMutation({
    mutationFn: settingsService.updateAISettings,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('AI API key saved');
      setAiApiKey('');
      setShowAiApiKey(false);
      queryClient.invalidateQueries({ queryKey: ['settings', 'ai', activeTenant?.id] });
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error, error?.response?.data?.message || 'Failed to save AI API key');
    },
  });

  const deleteAISettingsMutation = useMutation({
    mutationFn: settingsService.deleteAISettings,
    onSuccess: () => {
      showSuccess('AI API key removed');
      setAiApiKey('');
      setShowAiApiKey(false);
      queryClient.invalidateQueries({ queryKey: ['settings', 'ai', activeTenant?.id] });
    },
    onError: (error) => {
      showError(error, error?.response?.data?.message || 'Failed to remove AI API key');
    },
  });

  const handleSaveAISettings = useCallback(() => {
    const trimmedKey = aiApiKey.trim();
    if (!trimmedKey) {
      showError(null, 'Enter your Anthropic API key');
      return;
    }
    savingToastDismissRef.current = showLoading('Saving...');
    updateAISettingsMutation.mutate({ apiKey: trimmedKey });
  }, [aiApiKey, updateAISettingsMutation]);

  const handleRemoveAISettings = useCallback(() => {
    deleteAISettingsMutation.mutate();
  }, [deleteAISettingsMutation]);

  return {
    canManageOrganization,
    loadingAISettings,
    aiSettings,
    aiSourceText,
    aiApiKey,
    setAiApiKey,
    showAiApiKey,
    setShowAiApiKey,
    updateAISettingsMutation,
    deleteAISettingsMutation,
    handleSaveAISettings,
    handleRemoveAISettings,
  };
};
