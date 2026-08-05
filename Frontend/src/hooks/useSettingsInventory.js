import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { usePOSConfig } from './usePOSConfig';
import { showError, showLoading, showSuccess } from '../utils/toast';
import { mergeScanningConfig } from '../utils/posScanningConfig';

/**
 * Inventory settings — barcode/camera scanning toggle.
 * @returns {Object}
 */
export const useSettingsInventory = () => {
  const queryClient = useQueryClient();
  const { isManager } = useAuth();
  const canManageOrganization = Boolean(isManager);
  const savingToastDismissRef = useRef(null);
  const { posConfig, isLoading } = usePOSConfig();

  const scanningConfig = mergeScanningConfig(posConfig?.scanning);

  const dismissSavingToast = useCallback(() => {
    if (savingToastDismissRef.current) {
      savingToastDismissRef.current();
      savingToastDismissRef.current = null;
    }
  }, []);

  const updatePOSConfigMutation = useMutation({
    mutationFn: settingsService.updatePOSConfig,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('Inventory settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'pos-config'] });
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error?.response?.data?.message || error?.message || 'Failed to save inventory settings');
    },
  });

  const handleScanningEnabledToggle = useCallback((checked) => {
    savingToastDismissRef.current = showLoading('Saving...');
    updatePOSConfigMutation.mutate({
      scanning: { enabled: checked },
    });
  }, [updatePOSConfigMutation]);

  return {
    canManageOrganization,
    isLoading,
    scanningEnabled: scanningConfig.enabled,
    updatePOSConfigMutation,
    handleScanningEnabledToggle,
  };
};
