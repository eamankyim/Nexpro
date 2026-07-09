import { useCallback, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { showError, showLoading, showSuccess } from '../utils/toast';
import { STUDIO_LIKE_TYPES, QUERY_CACHE } from '../constants';

/**
 * Quote accept workflow and auto-send invoice on job creation.
 * @returns {Object}
 */
export const useSettingsWorkflows = () => {
  const queryClient = useQueryClient();
  const { activeTenant, isManager } = useAuth();
  const canManageOrganization = Boolean(isManager);
  const savingToastDismissRef = useRef(null);

  const isStudioLike = useMemo(
    () => STUDIO_LIKE_TYPES.includes(activeTenant?.businessType || 'printing_press'),
    [activeTenant?.businessType]
  );

  const dismissSavingToast = useCallback(() => {
    if (savingToastDismissRef.current) {
      savingToastDismissRef.current();
      savingToastDismissRef.current = null;
    }
  }, []);

  const { data: quoteWorkflowData } = useQuery({
    queryKey: ['settings', 'quote-workflow'],
    queryFn: settingsService.getQuoteWorkflow,
    enabled: canManageOrganization,
    staleTime: QUERY_CACHE.STALE_TIME_DEFAULT,
  });

  const { data: jobInvoiceData } = useQuery({
    queryKey: ['settings', 'job-invoice'],
    queryFn: settingsService.getJobInvoice,
    enabled: canManageOrganization,
    staleTime: QUERY_CACHE.STALE_TIME_DEFAULT,
  });

  const updateQuoteWorkflowMutation = useMutation({
    mutationFn: settingsService.updateQuoteWorkflow,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('Quote workflow saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'quote-workflow'] });
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error?.response?.data?.message || error?.message || 'Failed to save quote workflow');
    },
  });

  const updateJobInvoiceMutation = useMutation({
    mutationFn: settingsService.updateJobInvoice,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('Job invoice settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'job-invoice'] });
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error?.response?.data?.message || error?.message || 'Failed to save job invoice settings');
    },
  });

  const quoteWorkflowOnAccept = quoteWorkflowData?.onAccept || 'record_only';
  const quoteWorkflowEnabled = isStudioLike
    ? quoteWorkflowOnAccept === 'create_job_invoice_and_send'
    : ['create_sale_invoice_and_send', 'create_job_invoice_and_send'].includes(quoteWorkflowOnAccept);

  const handleQuoteWorkflowChange = useCallback((checked) => {
    savingToastDismissRef.current = showLoading('Saving...');
    updateQuoteWorkflowMutation.mutate({
      onAccept: checked
        ? (isStudioLike ? 'create_job_invoice_and_send' : 'create_sale_invoice_and_send')
        : 'record_only',
    });
  }, [isStudioLike, updateQuoteWorkflowMutation]);

  const handleAutoSendInvoiceOnJobCreation = useCallback((checked) => {
    savingToastDismissRef.current = showLoading('Saving...');
    updateJobInvoiceMutation.mutate({ autoSendInvoiceOnJobCreation: checked });
  }, [updateJobInvoiceMutation]);

  return {
    canManageOrganization,
    isStudioLike,
    quoteWorkflowEnabled,
    jobInvoiceData,
    updateQuoteWorkflowMutation,
    updateJobInvoiceMutation,
    handleQuoteWorkflowChange,
    handleAutoSendInvoiceOnJobCreation,
  };
};
