import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { showError, showLoading, showSuccess } from '../utils/toast';
import { QUERY_CACHE } from '../constants';
import {
  DEFAULT_DELIVERY_SETTINGS,
  createDeliveryBand,
} from '../utils/settingsUtils';

/**
 * POS delivery fee bands and checkout requirements.
 * @returns {Object}
 */
export const useSettingsDelivery = () => {
  const queryClient = useQueryClient();
  const { isManager } = useAuth();
  const canManageOrganization = Boolean(isManager);
  const savingToastDismissRef = useRef(null);
  const [deliverySettingsEditing, setDeliverySettingsEditing] = useState(false);
  const [deliveryDraft, setDeliveryDraft] = useState(DEFAULT_DELIVERY_SETTINGS);

  const dismissSavingToast = useCallback(() => {
    if (savingToastDismissRef.current) {
      savingToastDismissRef.current();
      savingToastDismissRef.current = null;
    }
  }, []);

  const { data: deliverySettingsData, isLoading: loadingDeliverySettings } = useQuery({
    queryKey: ['settings', 'delivery'],
    queryFn: settingsService.getDeliverySettings,
    enabled: canManageOrganization,
    staleTime: QUERY_CACHE.STALE_TIME_DEFAULT,
  });

  const deliverySettings = deliverySettingsData?.data?.data
    ?? deliverySettingsData?.data
    ?? deliverySettingsData
    ?? DEFAULT_DELIVERY_SETTINGS;

  useEffect(() => {
    if (!canManageOrganization || deliverySettingsEditing) return;
    const settings = deliverySettingsData?.data?.data ?? deliverySettingsData?.data ?? deliverySettingsData;
    if (settings && typeof settings === 'object') {
      setDeliveryDraft({
        enabled: settings.enabled === true,
        requireSelectionAtCheckout: settings.requireSelectionAtCheckout === true,
        bands: Array.isArray(settings.bands)
          ? settings.bands.map((band, index) => ({
            id: band.id || `band_${index + 1}`,
            label: band.label || '',
            minKm: band.minKm ?? '',
            maxKm: band.maxKm ?? '',
            fee: band.fee ?? '',
          }))
          : [],
      });
    }
  }, [deliverySettingsData, canManageOrganization, deliverySettingsEditing]);

  const updateDeliverySettingsMutation = useMutation({
    mutationFn: settingsService.updateDeliverySettings,
    onSuccess: async (data) => {
      dismissSavingToast();
      showSuccess('Delivery settings saved');
      await queryClient.invalidateQueries({ queryKey: ['settings', 'delivery'] });
      const next = data?.data?.data ?? data?.data ?? data;
      if (next && typeof next === 'object') {
        setDeliveryDraft({
          enabled: next.enabled === true,
          requireSelectionAtCheckout: next.requireSelectionAtCheckout === true,
          bands: Array.isArray(next.bands) ? next.bands : [],
        });
      }
      setDeliverySettingsEditing(false);
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error, error?.response?.data?.message || 'Failed to update delivery settings');
    },
  });

  const handleDeliveryDraftChange = useCallback((patch) => {
    setDeliveryDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleDeliveryBandChange = useCallback((id, field, value) => {
    setDeliveryDraft((prev) => ({
      ...prev,
      bands: (prev.bands || []).map((band) => (
        band.id === id ? { ...band, [field]: value } : band
      )),
    }));
  }, []);

  const handleAddDeliveryBand = useCallback(() => {
    setDeliveryDraft((prev) => ({
      ...prev,
      bands: [...(prev.bands || []), createDeliveryBand((prev.bands || []).length)],
    }));
  }, []);

  const handleRemoveDeliveryBand = useCallback((id) => {
    setDeliveryDraft((prev) => ({
      ...prev,
      bands: (prev.bands || []).filter((band) => band.id !== id),
    }));
  }, []);

  const handleResetDeliveryDraft = useCallback(() => {
    const settings = deliverySettingsData?.data?.data
      ?? deliverySettingsData?.data
      ?? deliverySettingsData
      ?? DEFAULT_DELIVERY_SETTINGS;
    setDeliveryDraft({
      enabled: settings.enabled === true,
      requireSelectionAtCheckout: settings.requireSelectionAtCheckout === true,
      bands: Array.isArray(settings.bands) ? settings.bands : [],
    });
  }, [deliverySettingsData]);

  const handleSaveDeliverySettings = useCallback(() => {
    const payload = {
      enabled: deliveryDraft.enabled === true,
      requireSelectionAtCheckout: deliveryDraft.requireSelectionAtCheckout === true,
      bands: (deliveryDraft.bands || []).map((band, index) => ({
        id: String(band.id || `band_${index + 1}`),
        label: String(band.label || '').trim(),
        minKm: Number(band.minKm),
        maxKm: Number(band.maxKm),
        fee: Number(band.fee),
      })),
    };
    savingToastDismissRef.current = showLoading('Saving...');
    updateDeliverySettingsMutation.mutate(payload);
  }, [deliveryDraft, updateDeliverySettingsMutation]);

  const startDeliveryEdit = useCallback(() => {
    handleResetDeliveryDraft();
    setDeliverySettingsEditing(true);
  }, [handleResetDeliveryDraft]);

  const cancelDeliveryEdit = useCallback(() => {
    handleResetDeliveryDraft();
    setDeliverySettingsEditing(false);
  }, [handleResetDeliveryDraft]);

  return {
    canManageOrganization,
    loadingDeliverySettings,
    deliverySettings,
    deliverySettingsEditing,
    deliveryDraft,
    updateDeliverySettingsMutation,
    handleDeliveryDraftChange,
    handleDeliveryBandChange,
    handleAddDeliveryBand,
    handleRemoveDeliveryBand,
    handleSaveDeliverySettings,
    startDeliveryEdit,
    cancelDeliveryEdit,
  };
};
