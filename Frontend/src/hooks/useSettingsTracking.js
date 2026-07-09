import { useCallback, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { showError, showLoading, showSuccess } from '../utils/toast';
import { STUDIO_LIKE_TYPES, QUERY_CACHE } from '../constants';

/**
 * Public customer tracking page toggles and share URL.
 * @returns {Object}
 */
export const useSettingsTracking = () => {
  const queryClient = useQueryClient();
  const { activeTenant, isManager } = useAuth();
  const canManageOrganization = Boolean(isManager);
  const savingToastDismissRef = useRef(null);

  const isStudioLike = useMemo(
    () => STUDIO_LIKE_TYPES.includes(activeTenant?.businessType || 'printing_press'),
    [activeTenant?.businessType]
  );
  const trackingEntityLabel = isStudioLike ? 'Job' : 'Order';

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
      showSuccess('Tracking settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'job-invoice'] });
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error?.response?.data?.message || error?.message || 'Failed to save tracking settings');
    },
  });

  const publicTrackingUrl = useMemo(() => {
    const slug = jobInvoiceData?.tenantSlug || activeTenant?.slug;
    if (!slug) return '';
    if (typeof window === 'undefined') return `/track/${slug}`;
    return `${window.location.origin}/track/${slug}`;
  }, [jobInvoiceData?.tenantSlug, activeTenant?.slug]);

  const handleCopyTrackingUrl = useCallback(async () => {
    if (!publicTrackingUrl) return;
    try {
      await navigator.clipboard.writeText(publicTrackingUrl);
      showSuccess(`${trackingEntityLabel} tracking link copied`);
    } catch (error) {
      showError(error, 'Failed to copy tracking link');
    }
  }, [publicTrackingUrl, trackingEntityLabel]);

  const handleCustomerTrackingToggle = useCallback((checked) => {
    savingToastDismissRef.current = showLoading('Saving...');
    updateJobInvoiceMutation.mutate(
      checked
        ? { customerJobTrackingEnabled: true }
        : { customerJobTrackingEnabled: false, emailCustomerJobTrackingOnJobCreation: false }
    );
  }, [updateJobInvoiceMutation]);

  const handleEmailTrackingOnJobCreation = useCallback((checked) => {
    savingToastDismissRef.current = showLoading('Saving...');
    updateJobInvoiceMutation.mutate({ emailCustomerJobTrackingOnJobCreation: checked });
  }, [updateJobInvoiceMutation]);

  return {
    canManageOrganization,
    isStudioLike,
    trackingEntityLabel,
    loadingJobInvoice,
    jobInvoiceData,
    publicTrackingUrl,
    updateJobInvoiceMutation,
    handleCopyTrackingUrl,
    handleCustomerTrackingToggle,
    handleEmailTrackingOnJobCreation,
  };
};
