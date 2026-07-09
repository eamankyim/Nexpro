import { useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { showError, showLoading, showSuccess } from '../utils/toast';
import { QUERY_CACHE } from '../constants';

/**
 * Inventory cost automation settings.
 * @returns {Object}
 */
export const useSettingsInventory = () => {
  const queryClient = useQueryClient();
  const { isManager } = useAuth();
  const canManageOrganization = Boolean(isManager);
  const savingToastDismissRef = useRef(null);

  const dismissSavingToast = useCallback(() => {
    if (savingToastDismissRef.current) {
      savingToastDismissRef.current();
      savingToastDismissRef.current = null;
    }
  }, []);

  const { data: jobInvoiceData, isLoading: loadingJobInvoice } = useQuery({
    queryKey: ['settings', 'job-invoice'],
    queryFn: settingsService.getJobInvoice,
    enabled: canManageOrganization,
    staleTime: QUERY_CACHE.STALE_TIME_DEFAULT,
  });

  const updateJobInvoiceMutation = useMutation({
    mutationFn: settingsService.updateJobInvoice,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('Inventory settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'job-invoice'] });
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error?.response?.data?.message || error?.message || 'Failed to save inventory settings');
    },
  });

  const handleAutoCreateExpenseChange = useCallback((checked) => {
    savingToastDismissRef.current = showLoading('Saving...');
    updateJobInvoiceMutation.mutate({ autoCreateExpenseFromProductCost: checked });
  }, [updateJobInvoiceMutation]);

  return {
    canManageOrganization,
    loadingJobInvoice,
    jobInvoiceData,
    updateJobInvoiceMutation,
    handleAutoCreateExpenseChange,
  };
};
