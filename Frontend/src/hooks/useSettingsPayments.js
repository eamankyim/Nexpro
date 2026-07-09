import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { showError, showLoading, showSuccess } from '../utils/toast';
import { QUERY_CACHE } from '../constants';
import { PAYMENT_COLLECTION_SUBTABS, paymentCollectionSchema } from '../utils/settingsUtils';

/**
 * Payment collections settings (Paystack settlements, MTN MoMo, payout destination).
 * @returns {Object}
 */
export const useSettingsPayments = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isManager, activeTenant, refreshAuthState } = useAuth();
  const canManageOrganization = Boolean(isManager);
  const savingToastDismissRef = useRef(null);
  const paymentAuthRefreshAttemptedRef = useRef(false);

  const returnToParam = searchParams.get('returnTo');
  const safeReturnTo = returnToParam && returnToParam.startsWith('/') && !returnToParam.startsWith('//')
    ? returnToParam
    : null;
  const paymentMethodParam = searchParams.get('method') || searchParams.get('paymentMethod');
  const requestedPaymentMethod = ['mobileMoney', 'card'].includes(paymentMethodParam) ? paymentMethodParam : null;
  const requestedSettlementType = requestedPaymentMethod === 'mobileMoney' ? 'momo' : 'bank';

  const subtabFromUrl = searchParams.get('subtab');
  const [paymentsSubTab, setPaymentsSubTab] = useState(
    subtabFromUrl === 'mtn-collection' ? 'mtn-collection' : 'settlements'
  );

  const [paymentVerifyPassword, setPaymentVerifyPassword] = useState('');
  const [paymentVerifyOtp, setPaymentVerifyOtp] = useState('');
  const [paymentOtpSending, setPaymentOtpSending] = useState(false);
  const [paymentOtpSent, setPaymentOtpSent] = useState(false);
  const [paymentVerifyModalOpen, setPaymentVerifyModalOpen] = useState(false);
  const [paymentVerificationDone, setPaymentVerificationDone] = useState(false);
  const [paymentPasswordVerifying, setPaymentPasswordVerifying] = useState(false);
  const [bankSelectOpen, setBankSelectOpen] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [mtnCredForm, setMtnCredForm] = useState({
    subscriptionKey: '',
    apiUser: '',
    apiKey: '',
    environment: 'sandbox',
    collectionApiUrl: '',
    callbackUrl: '',
  });
  const [mtnOtp, setMtnOtp] = useState('');
  const [mtnGatePassword, setMtnGatePassword] = useState('');
  const [mtnSaving, setMtnSaving] = useState(false);
  const [mtnTesting, setMtnTesting] = useState(false);
  const [mtnDisconnecting, setMtnDisconnecting] = useState(false);
  const [paystackTxFrom, setPaystackTxFrom] = useState(() => dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [paystackTxTo, setPaystackTxTo] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [paystackTxPage, setPaystackTxPage] = useState(1);

  const isGoogleUser = Boolean(
    user?.paymentVerificationMethod === 'otp' ||
    user?.authProvider === 'google' ||
    user?.googleId
  );

  useEffect(() => {
    const subtab = searchParams.get('subtab');
    if (subtab === 'mtn-collection' || subtab === 'settlements') {
      setPaymentsSubTab(subtab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (paymentAuthRefreshAttemptedRef.current || !user?.id) return;
    if (user.paymentVerificationMethod || user.authProvider || user.googleId) return;
    paymentAuthRefreshAttemptedRef.current = true;
    refreshAuthState?.().catch(() => {});
  }, [refreshAuthState, user?.authProvider, user?.googleId, user?.id, user?.paymentVerificationMethod]);

  const paymentCollectionForm = useForm({
    resolver: zodResolver(paymentCollectionSchema),
    defaultValues: {
      settlement_type: 'bank',
      business_name: '',
      bank_code: '',
      bank_name: '',
      account_number: '',
      primary_contact_email: '',
      momo_phone: '',
      momo_provider: '',
    },
  });

  const { data: organizationData } = useQuery({
    queryKey: ['settings', 'organization', activeTenant?.id],
    queryFn: settingsService.getOrganization,
    enabled: canManageOrganization && !!activeTenant?.id,
  });

  const { data: paymentCollectionData, isLoading: loadingPaymentCollection } = useQuery({
    queryKey: ['settings', 'payment-collection', activeTenant?.id],
    queryFn: settingsService.getPaymentCollectionSettings,
    enabled: canManageOrganization && !!activeTenant?.id,
    staleTime: QUERY_CACHE.STALE_TIME_VOLATILE,
    refetchOnMount: 'always',
  });

  const { data: paymentCollectionBanks = [], isLoading: loadingBanks, isError: banksLoadError, refetch: refetchBanks } = useQuery({
    queryKey: ['settings', 'payment-collection-banks', activeTenant?.id],
    queryFn: settingsService.getPaymentCollectionBanks,
    enabled: canManageOrganization && !!activeTenant?.id,
  });

  useEffect(() => {
    setPaystackTxPage(1);
  }, [paystackTxFrom, paystackTxTo]);

  const { data: paystackTxPayload, isLoading: loadingPaystackTx, isError: paystackTxIsError, error: paystackTxError, refetch: refetchPaystackTx } = useQuery({
    queryKey: ['settings', 'paystack-transactions', activeTenant?.id, paystackTxFrom, paystackTxTo, paystackTxPage],
    queryFn: () => settingsService.getPaystackWorkspaceTransactions({
      from: paystackTxFrom,
      to: paystackTxTo,
      page: paystackTxPage,
      perPage: 20,
    }),
    enabled: canManageOrganization && !!activeTenant?.id && paymentsSubTab === 'settlements',
  });

  const filteredBanksList = useMemo(() => {
    const list = Array.isArray(paymentCollectionBanks) ? paymentCollectionBanks : (paymentCollectionBanks?.data ?? []);
    const q = (bankSearchQuery || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((b) => (b.name || '').toLowerCase().includes(q) || (b.code || '').toLowerCase().includes(q));
  }, [paymentCollectionBanks, bankSearchQuery]);

  useEffect(() => {
    const rawPc = paymentCollectionData?.data ?? paymentCollectionData;
    const pc = rawPc && typeof rawPc === 'object' && rawPc.data != null && (rawPc.success === true || rawPc.success === 'true') ? rawPc.data : rawPc;
    const org = organizationData?.data;
    if (!canManageOrganization) return;
    const settlementType = pc
      ? pc.settlement_type || (pc.hasSubaccount ? 'bank' : (pc.momo_phone_masked || pc.momo_provider ? 'momo' : requestedSettlementType))
      : requestedSettlementType;
    const businessName = pc?.business_name?.trim() || org?.name?.trim() || org?.legalName?.trim() || '';
    const contactEmail = pc?.primary_contact_email?.trim() || org?.email?.trim() || org?.supportEmail?.trim() || '';
    paymentCollectionForm.reset({
      settlement_type: settlementType,
      business_name: businessName,
      bank_code: pc?.bank_code || '',
      bank_name: pc?.bank_name || '',
      account_number: '',
      primary_contact_email: contactEmail,
      momo_phone: '',
      momo_provider: (pc?.momo_provider || '').toUpperCase() || '',
    });
  }, [paymentCollectionData, organizationData, canManageOrganization, paymentCollectionForm, requestedSettlementType]);

  useEffect(() => {
    const rawPc = paymentCollectionData?.data ?? paymentCollectionData;
    const pcInner = rawPc && typeof rawPc === 'object' && rawPc.data != null && (rawPc.success === true || rawPc.success === 'true')
      ? rawPc.data
      : rawPc;
    const mc = pcInner?.mtn_collection;
    if (mc && canManageOrganization) {
      setMtnCredForm((f) => ({
        ...f,
        environment: mc.environment === 'production' ? 'production' : 'sandbox',
        collectionApiUrl: mc.collectionApiUrl || '',
        callbackUrl: mc.callbackUrl || '',
      }));
    }
  }, [paymentCollectionData, canManageOrganization]);

  const dismissSavingToast = useCallback(() => {
    if (savingToastDismissRef.current) {
      savingToastDismissRef.current();
      savingToastDismissRef.current = null;
    }
  }, []);

  const updatePaymentCollectionMutation = useMutation({
    mutationFn: settingsService.updatePaymentCollectionSettings,
    onSuccess: async (response) => {
      dismissSavingToast();
      showSuccess(response?.message || 'Payment collection updated');
      setPaymentVerifyPassword('');
      setPaymentVerifyOtp('');
      setPaymentOtpSent(false);
      setPaymentVerificationDone(false);
      const data = response?.data ?? response;
      if (data && activeTenant?.id) {
        queryClient.setQueryData(['settings', 'payment-collection', activeTenant.id], { success: true, data: { ...data, configured: true } });
      }
      await queryClient.invalidateQueries({ queryKey: ['settings', 'payment-collection'] });
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error, error?.response?.data?.message || error?.message || 'Failed to update payment collection');
    },
  });

  const setPaymentsSection = useCallback((key) => {
    setPaymentsSubTab(key);
    const params = new URLSearchParams(searchParams);
    params.set('subtab', key === 'mtn-collection' ? 'mtn-collection' : 'settlements');
    if (safeReturnTo) params.set('returnTo', safeReturnTo);
    if (requestedPaymentMethod) params.set('method', requestedPaymentMethod);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams, safeReturnTo, requestedPaymentMethod]);

  const handleSendPaymentOtp = useCallback(async () => {
    const pwd = (paymentVerifyPassword || '').trim();
    if (!isGoogleUser && !pwd) {
      showError(null, 'Enter your account password to receive a code.');
      return;
    }
    setPaymentOtpSending(true);
    try {
      await settingsService.sendPaymentCollectionOtp(isGoogleUser ? undefined : pwd);
      setPaymentOtpSent(true);
      showSuccess('Verification code sent to your account email');
    } catch (err) {
      showError(err, 'Could not send verification code');
    } finally {
      setPaymentOtpSending(false);
    }
  }, [isGoogleUser, paymentVerifyPassword]);

  const handleVerifyPaymentPassword = useCallback(async () => {
    const pwd = (paymentVerifyPassword || '').trim();
    if (!isGoogleUser && !pwd) {
      showError(null, 'Enter your account password');
      return;
    }
    const otp = (paymentVerifyOtp || '').replace(/\D/g, '');
    if (isGoogleUser && otp.length !== 6) {
      showError(null, 'Enter the 6-digit code from your email');
      return;
    }
    setPaymentPasswordVerifying(true);
    try {
      if (isGoogleUser) {
        await settingsService.verifyPaymentCollectionOtp({ otp });
      } else {
        await settingsService.verifyPaymentCollectionPassword(pwd);
      }
      setPaymentVerificationDone(true);
      setPaymentVerifyModalOpen(false);
      showSuccess('Identity verified. You can link your payment account.');
    } catch (err) {
      showError(err, err?.response?.data?.message || (isGoogleUser ? 'Verification failed' : 'Invalid password'));
    } finally {
      setPaymentPasswordVerifying(false);
    }
  }, [isGoogleUser, paymentVerifyOtp, paymentVerifyPassword]);

  const onPaymentCollectionSubmit = useCallback(async (values) => {
    const pwd = (paymentVerifyPassword || '').trim();
    if (!isGoogleUser && !pwd) {
      showError(null, 'Password is required to link a payment account');
      return;
    }
    const otp = (paymentVerifyOtp || '').replace(/\D/g, '');
    if (isGoogleUser && !paymentVerificationDone && otp.length !== 6) {
      showError(null, 'Verify the email code before linking a payment account');
      return;
    }
    const settlementType = values.settlement_type || 'bank';
    const googleAuth = isGoogleUser && otp.length === 6 ? { otp } : isGoogleUser && paymentVerificationDone ? {} : null;
    if (isGoogleUser && !googleAuth) {
      showError(null, 'Verify the email code before linking a payment account');
      return;
    }
    savingToastDismissRef.current = showLoading('Saving...');
    if (settlementType === 'momo') {
      updatePaymentCollectionMutation.mutate({
        settlement_type: 'momo',
        business_name: values.business_name.trim(),
        momo_phone: String(values.momo_phone || '').replace(/\s/g, ''),
        momo_provider: (values.momo_provider || '').toUpperCase().trim(),
        primary_contact_email: values.primary_contact_email?.trim() || undefined,
        ...(isGoogleUser ? googleAuth : { password: pwd }),
      });
    } else {
      const banks = Array.isArray(paymentCollectionBanks) ? paymentCollectionBanks : (paymentCollectionBanks?.data ?? []);
      const bank = banks.find((b) => b.code === values.bank_code);
      updatePaymentCollectionMutation.mutate({
        settlement_type: 'bank',
        business_name: values.business_name.trim(),
        bank_code: values.bank_code,
        bank_name: bank?.name || values.bank_name || '',
        account_number: String(values.account_number).replace(/\s/g, ''),
        primary_contact_email: values.primary_contact_email?.trim() || undefined,
        ...(isGoogleUser ? googleAuth : { password: pwd }),
      });
    }
  }, [isGoogleUser, paymentVerificationDone, paymentVerifyOtp, paymentVerifyPassword, paymentCollectionBanks, updatePaymentCollectionMutation]);

  const buildMtnCredPayload = useCallback(() => ({
    password: isGoogleUser ? undefined : mtnGatePassword,
    otp: (mtnOtp || '').replace(/\D/g, ''),
    subscriptionKey: mtnCredForm.subscriptionKey.trim(),
    apiUser: mtnCredForm.apiUser.trim(),
    apiKey: mtnCredForm.apiKey.trim(),
    environment: mtnCredForm.environment,
    collectionApiUrl: mtnCredForm.collectionApiUrl.trim() || undefined,
    callbackUrl: mtnCredForm.callbackUrl.trim() || undefined,
  }), [isGoogleUser, mtnCredForm, mtnGatePassword, mtnOtp]);

  const handleMtnSendOtp = useCallback(async () => {
    if (!isGoogleUser && !mtnGatePassword.trim()) {
      showError('Enter your account password to receive a code.');
      return;
    }
    try {
      await settingsService.sendPaymentCollectionOtp(isGoogleUser ? undefined : mtnGatePassword);
      showSuccess('Verification code sent to your email');
    } catch (e) {
      showError(e, 'Could not send code');
    }
  }, [isGoogleUser, mtnGatePassword]);

  const handleMtnTest = useCallback(async () => {
    const p = buildMtnCredPayload();
    if (p.otp.length !== 6) {
      showError('Enter the 6-digit code from your email');
      return;
    }
    setMtnTesting(true);
    try {
      await settingsService.testMtnCollectionCredentials(p);
      showSuccess('MTN connection OK');
    } catch (e) {
      showError(e, e?.response?.data?.message || 'Test failed');
    } finally {
      setMtnTesting(false);
    }
  }, [buildMtnCredPayload]);

  const handleMtnSave = useCallback(async () => {
    const p = buildMtnCredPayload();
    if (p.otp.length !== 6) {
      showError('Enter the 6-digit code from your email');
      return;
    }
    setMtnSaving(true);
    try {
      await settingsService.updateMtnCollectionCredentials(p);
      showSuccess('MTN credentials saved');
      setMtnOtp('');
      queryClient.invalidateQueries({ queryKey: ['settings', 'payment-collection', activeTenant?.id] });
    } catch (e) {
      showError(e, e?.response?.data?.message || 'Save failed');
    } finally {
      setMtnSaving(false);
    }
  }, [activeTenant?.id, buildMtnCredPayload, queryClient]);

  const handleMtnDisconnect = useCallback(async () => {
    const p = buildMtnCredPayload();
    if (p.otp.length !== 6) {
      showError('Enter the 6-digit code from your email');
      return;
    }
    setMtnDisconnecting(true);
    try {
      await settingsService.disconnectMtnCollectionCredentials({ password: p.password, otp: p.otp });
      showSuccess('Workspace MTN credentials removed');
      setMtnOtp('');
      setMtnCredForm((f) => ({ ...f, subscriptionKey: '', apiUser: '', apiKey: '' }));
      queryClient.invalidateQueries({ queryKey: ['settings', 'payment-collection', activeTenant?.id] });
    } catch (e) {
      showError(e, e?.response?.data?.message || 'Could not remove credentials');
    } finally {
      setMtnDisconnecting(false);
    }
  }, [activeTenant?.id, buildMtnCredPayload, queryClient]);

  const rawPc = paymentCollectionData?.data ?? paymentCollectionData;
  const pc = rawPc && typeof rawPc === 'object' && rawPc.data != null && (rawPc.success === true || rawPc.success === 'true') ? rawPc.data : rawPc;
  const hasPaymentSubaccount = pc?.hasSubaccount === true;
  const isMomoLinked = pc?.settlement_type === 'momo' && (pc?.momo_phone_masked || pc?.momo_provider || pc?.configured);
  const paymentAlreadyLinked = Boolean(pc?.hasSubaccount || pc?.configured || isMomoLinked);
  const paymentSettlementMethod = pc?.settlement_type === 'momo' ? 'MoMo' : pc?.settlement_type === 'bank' ? 'Bank account' : 'Configured payout';
  const paymentDestinationLabel = pc?.settlement_type === 'momo' ? 'MoMo wallet' : 'Bank account';
  const paymentDestinationValue = pc?.settlement_type === 'momo'
    ? [pc?.momo_provider, pc?.momo_phone_masked].filter(Boolean).join(' · ') || 'Linked MoMo wallet'
    : [pc?.bank_name, pc?.account_number_masked].filter(Boolean).join(' · ') || 'Linked bank account';
  const banksList = Array.isArray(paymentCollectionBanks) ? paymentCollectionBanks : (paymentCollectionBanks?.data ?? []);

  return {
    canManageOrganization,
    safeReturnTo,
    paymentsSubTab,
    setPaymentsSection,
    paymentCollectionForm,
    loadingPaymentCollection,
    loadingBanks,
    banksLoadError,
    refetchBanks,
    filteredBanksList,
    banksList,
    paystackTxFrom,
    setPaystackTxFrom,
    paystackTxTo,
    setPaystackTxTo,
    paystackTxPage,
    setPaystackTxPage,
    paystackTxPayload,
    loadingPaystackTx,
    paystackTxIsError,
    paystackTxError,
    refetchPaystackTx,
    paymentVerifyPassword,
    setPaymentVerifyPassword,
    paymentVerifyOtp,
    setPaymentVerifyOtp,
    paymentOtpSending,
    paymentOtpSent,
    paymentVerifyModalOpen,
    setPaymentVerifyModalOpen,
    paymentVerificationDone,
    paymentPasswordVerifying,
    bankSelectOpen,
    setBankSelectOpen,
    bankSearchQuery,
    setBankSearchQuery,
    mtnCredForm,
    setMtnCredForm,
    mtnOtp,
    setMtnOtp,
    mtnGatePassword,
    setMtnGatePassword,
    mtnSaving,
    mtnTesting,
    mtnDisconnecting,
    isGoogleUser,
    handleSendPaymentOtp,
    handleVerifyPaymentPassword,
    onPaymentCollectionSubmit,
    updatePaymentCollectionMutation,
    handleMtnSendOtp,
    handleMtnTest,
    handleMtnSave,
    handleMtnDisconnect,
    pc,
    hasPaymentSubaccount,
    isMomoLinked,
    paymentAlreadyLinked,
    paymentSettlementMethod,
    paymentDestinationLabel,
    paymentDestinationValue,
    PAYMENT_COLLECTION_SUBTABS,
  };
};
