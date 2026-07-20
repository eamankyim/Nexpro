import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import smsService from '../services/smsService';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { showError, showLoading, showSuccess } from '../utils/toast';
import {
  SMS_SECTIONS,
  SMS_SEGMENT_LENGTH,
  SMS_TEMPLATE_PREVIEW_VARS,
} from '../utils/settingsUtils';

const smsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(['termii', 'twilio', 'africas_talking', 'arkesel']).default('termii'),
  senderId: z.string().optional(),
  apiKey: z.string().optional(),
  accountSid: z.string().optional(),
  authToken: z.string().optional(),
  fromNumber: z.string().optional(),
  username: z.string().optional(),
});

/**
 * SMS settings state and mutations (extracted from Settings.jsx).
 * @returns {Object}
 */
export const useSettingsSms = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isManager } = useAuth();
  const canManageOrganization = Boolean(isManager);
  const savingToastDismissRef = useRef(null);

  const sectionFromUrl = searchParams.get('section') || searchParams.get('smsSection');
  const [smsSubTab, setSmsSubTab] = useState(
    SMS_SECTIONS.includes(sectionFromUrl) ? sectionFromUrl : 'overview'
  );
  const [selectedSmsTemplateKey, setSelectedSmsTemplateKey] = useState('invoice_sent');
  const [smsTemplateDraft, setSmsTemplateDraft] = useState('');

  useEffect(() => {
    const section = searchParams.get('section') || searchParams.get('smsSection');
    if (SMS_SECTIONS.includes(section)) {
      setSmsSubTab(section);
    }
  }, [searchParams]);

  const smsForm = useForm({
    resolver: zodResolver(smsSchema),
    defaultValues: {
      enabled: false,
      provider: 'termii',
      senderId: '',
      apiKey: '',
      accountSid: '',
      authToken: '',
      fromNumber: '',
      username: '',
    },
  });

  const { data: smsData, isLoading: loadingSMS } = useQuery({
    queryKey: ['settings', 'sms'],
    queryFn: smsService.getSettings,
    enabled: canManageOrganization,
  });

  const { data: smsTemplatesData, isLoading: loadingSmsTemplates } = useQuery({
    queryKey: ['settings', 'sms-templates'],
    queryFn: settingsService.getSmsTemplates,
    enabled: canManageOrganization,
  });

  useEffect(() => {
    if (smsData?.data && canManageOrganization) {
      smsForm.reset({
        enabled: smsData.data.enabled || false,
        provider: smsData.data.provider || 'termii',
        senderId: smsData.data.senderId || '',
        apiKey: smsData.data.apiKey === '***' ? '' : (smsData.data.apiKey || ''),
        accountSid: smsData.data.accountSid || '',
        authToken: smsData.data.authToken === '***' ? '' : (smsData.data.authToken || ''),
        fromNumber: smsData.data.fromNumber || '',
        username: smsData.data.username || '',
      });
    }
  }, [smsData, smsForm, canManageOrganization]);

  const dismissSavingToast = useCallback(() => {
    if (savingToastDismissRef.current) {
      savingToastDismissRef.current();
      savingToastDismissRef.current = null;
    }
  }, []);

  const updateSMSMutation = useMutation({
    mutationFn: smsService.updateSettings,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('SMS settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'sms'] });
    },
    onError: (error) => {
      dismissSavingToast();
      const errMsg = error?.response?.data?.message || 'Failed to update SMS settings';
      showError(error, errMsg);
    },
  });

  const testSMSMutation = useMutation({
    mutationFn: (config) => smsService.testConnection(config),
    onSuccess: (data) => {
      const msg = data?.message
        || data?.data?.message
        || 'API key verified. Sender ID is only checked when a message is sent.';
      showSuccess(msg);
    },
    onError: (error) => {
      const errMsg = error?.response?.data?.error || error?.response?.data?.message || 'Connection test failed';
      showError(error, errMsg);
    },
  });

  const updateSmsTemplateMutation = useMutation({
    mutationFn: ({ eventKey, body }) => settingsService.updateSmsTemplate(eventKey, { body }),
    onSuccess: () => {
      showSuccess('SMS template saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'sms-templates'] });
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to save SMS template');
    },
  });

  const resetSmsTemplateMutation = useMutation({
    mutationFn: (eventKey) => settingsService.resetSmsTemplate(eventKey),
    onSuccess: (data) => {
      showSuccess('Template reset to default');
      if (data?.body) setSmsTemplateDraft(data.body);
      queryClient.invalidateQueries({ queryKey: ['settings', 'sms-templates'] });
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to reset template');
    },
  });

  const smsTemplatesList = useMemo(
    () => smsTemplatesData?.templates || [],
    [smsTemplatesData]
  );

  const selectedSmsTemplate = useMemo(
    () => smsTemplatesList.find((t) => t.eventKey === selectedSmsTemplateKey) || null,
    [smsTemplatesList, selectedSmsTemplateKey]
  );

  useEffect(() => {
    if (selectedSmsTemplate?.body) {
      setSmsTemplateDraft(selectedSmsTemplate.body);
    }
  }, [selectedSmsTemplate?.body, selectedSmsTemplateKey]);

  const smsTemplatePreviewText = useMemo(() => {
    if (!smsTemplateDraft) return '';
    let text = smsTemplateDraft;
    Object.entries(SMS_TEMPLATE_PREVIEW_VARS).forEach(([key, value]) => {
      text = text.split(`{${key}}`).join(value);
    });
    const prefixName = SMS_TEMPLATE_PREVIEW_VARS.branchName || SMS_TEMPLATE_PREVIEW_VARS.businessName;
    const prefixed = prefixName ? `${prefixName}: ${text}` : text;
    return prefixed.substring(0, SMS_SEGMENT_LENGTH);
  }, [smsTemplateDraft]);

  const smsTemplateCharCount = smsTemplatePreviewText.length;
  const smsTemplateSegmentCount = Math.max(1, Math.ceil(smsTemplateCharCount / SMS_SEGMENT_LENGTH));

  const setSmsSection = useCallback((section) => {
    setSmsSubTab(section);
    const params = new URLSearchParams(searchParams);
    if (section && section !== 'overview') {
      params.set('section', section);
    } else {
      params.delete('section');
      params.delete('smsSection');
    }
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const insertSmsTemplateVariable = useCallback((varName) => {
    setSmsTemplateDraft((prev) => {
      const token = `{${varName}}`;
      if (!prev) return token;
      return prev.endsWith(' ') ? `${prev}${token}` : `${prev} ${token}`;
    });
  }, []);

  const handleSaveSmsTemplate = useCallback(() => {
    if (!selectedSmsTemplateKey || !smsTemplateDraft.trim()) {
      showError('Template message cannot be empty');
      return;
    }
    updateSmsTemplateMutation.mutate({ eventKey: selectedSmsTemplateKey, body: smsTemplateDraft.trim() });
  }, [selectedSmsTemplateKey, smsTemplateDraft, updateSmsTemplateMutation]);

  const handleResetSmsTemplate = useCallback(() => {
    if (!selectedSmsTemplateKey) return;
    resetSmsTemplateMutation.mutate(selectedSmsTemplateKey);
  }, [selectedSmsTemplateKey, resetSmsTemplateMutation]);

  const getSMSTestConfig = useCallback((values) => {
    const provider = values?.provider || 'termii';
    let config = { provider };
    if (provider === 'termii') {
      if (!values?.apiKey?.trim()) {
        showError(null, 'Please provide API Key to test connection');
        return null;
      }
      config = { ...config, apiKey: values.apiKey.trim() };
    } else if (provider === 'arkesel') {
      if (!values?.apiKey?.trim()) {
        showError(null, 'Please provide API Key to test connection');
        return null;
      }
      config = { ...config, apiKey: values.apiKey.trim(), senderId: values.senderId?.trim() || '' };
    } else if (provider === 'twilio') {
      if (!values?.accountSid?.trim() || !values?.authToken) {
        showError(null, 'Please provide Account SID and Auth Token to test connection');
        return null;
      }
      config = { ...config, accountSid: values.accountSid.trim(), authToken: values.authToken };
    } else if (provider === 'africas_talking') {
      if (!values?.apiKey?.trim() || !values?.username?.trim()) {
        showError(null, 'Please provide API Key and Username to test connection');
        return null;
      }
      config = { ...config, apiKey: values.apiKey.trim(), username: values.username.trim() };
    }
    return config;
  }, []);

  const handleTestSMS = useCallback(() => {
    const config = getSMSTestConfig(smsForm.getValues());
    if (config) testSMSMutation.mutate(config);
  }, [getSMSTestConfig, smsForm, testSMSMutation]);

  const handleSMSEnabledChange = useCallback((checked, fieldOnChange) => {
    if (!checked) {
      fieldOnChange(false);
      return;
    }
    const config = getSMSTestConfig(smsForm.getValues());
    if (!config) return;
    testSMSMutation
      .mutateAsync(config)
      .then(() => {
        fieldOnChange(true);
        showSuccess('API key verified. SMS is enabled. Sender ID is only checked when a message is sent.');
      })
      .catch(() => {});
  }, [getSMSTestConfig, smsForm, testSMSMutation]);

  const onSMSSubmit = useCallback(async (values) => {
    savingToastDismissRef.current = showLoading('Saving...');
    updateSMSMutation.mutate({ ...values });
  }, [updateSMSMutation]);

  const smsPlatformInfo = smsData?.data?.platformSms;
  const smsMode = smsData?.data?.smsMode;
  const ownSmsToggleOn = smsForm.watch('enabled');
  const ownSmsActive = smsMode === 'own';
  const switchingToOwnSms = ownSmsToggleOn && !ownSmsActive;
  const platformSmsActive = Boolean(smsPlatformInfo) && smsMode === 'platform' && !switchingToOwnSms;
  const showPlatformSmsUsage = Boolean(smsPlatformInfo) && smsMode === 'platform';
  const noSmsAvailable = smsMode === 'none' && !smsPlatformInfo;
  const smsUsagePercent = smsPlatformInfo?.monthlyLimit
    ? Math.min(100, Math.round(((smsPlatformInfo.sentThisMonth || 0) / smsPlatformInfo.monthlyLimit) * 100))
    : 0;

  return {
    canManageOrganization,
    smsForm,
    smsData,
    loadingSMS,
    smsSubTab,
    setSmsSection,
    selectedSmsTemplateKey,
    setSelectedSmsTemplateKey,
    smsTemplateDraft,
    setSmsTemplateDraft,
    smsTemplatesList,
    selectedSmsTemplate,
    loadingSmsTemplates,
    smsTemplatePreviewText,
    smsTemplateCharCount,
    smsTemplateSegmentCount,
    insertSmsTemplateVariable,
    handleSaveSmsTemplate,
    handleResetSmsTemplate,
    updateSmsTemplateMutation,
    resetSmsTemplateMutation,
    onSMSSubmit,
    handleTestSMS,
    handleSMSEnabledChange,
    updateSMSMutation,
    testSMSMutation,
    smsPlatformInfo,
    platformSmsActive,
    ownSmsActive,
    switchingToOwnSms,
    showPlatformSmsUsage,
    noSmsAvailable,
    smsUsagePercent,
  };
};
