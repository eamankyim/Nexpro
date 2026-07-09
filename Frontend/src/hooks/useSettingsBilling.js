import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import settingsService from '../services/settingsService';
import inviteService from '../services/inviteService';
import { useAuth } from '../context/AuthContext';
import { QUERY_CACHE } from '../constants';
import { formatLabel, formatMinorCurrency, unwrapApiPayload } from '../utils/settingsUtils';

/**
 * ABS subscription billing summary and payment history.
 * @returns {Object}
 */
export const useSettingsBilling = () => {
  const { activeTenant, isManager } = useAuth();
  const canManageOrganization = Boolean(isManager);
  const [seatUsage, setSeatUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const { data: subscriptionData, isLoading: loadingSubscription } = useQuery({
    queryKey: ['settings', 'subscription'],
    queryFn: settingsService.getSubscription,
    enabled: canManageOrganization,
    staleTime: QUERY_CACHE.STALE_TIME_DEFAULT,
  });

  const { data: subscriptionPaymentsData, isLoading: loadingSubscriptionPayments } = useQuery({
    queryKey: ['subscription', 'payments'],
    queryFn: settingsService.getSubscriptionPayments,
    enabled: canManageOrganization,
  });

  useEffect(() => {
    if (!canManageOrganization || !activeTenant?.id) return;
    let cancelled = false;
    const fetchUsage = async () => {
      try {
        setLoadingUsage(true);
        const seatResponse = await inviteService.getSeatUsage();
        if (!cancelled && seatResponse?.success) {
          setSeatUsage(seatResponse.data);
        }
      } catch (error) {
        console.error('Failed to fetch usage data:', error);
      } finally {
        if (!cancelled) setLoadingUsage(false);
      }
    };
    fetchUsage();
    return () => { cancelled = true; };
  }, [activeTenant?.id, canManageOrganization]);

  const subscriptionBilling = unwrapApiPayload(subscriptionData)?.billing
    || unwrapApiPayload(subscriptionPaymentsData)?.billing;

  const subscriptionPaymentsPayload = unwrapApiPayload(subscriptionPaymentsData);
  const subscriptionPayments = useMemo(
    () => (Array.isArray(subscriptionPaymentsPayload?.payments) ? subscriptionPaymentsPayload.payments : []),
    [subscriptionPaymentsPayload?.payments]
  );
  const activeSubscriptionPayment = subscriptionPaymentsPayload?.activePayment;

  const currentSubscriptionPayload = unwrapApiPayload(subscriptionData);
  const currentSubscription = Object.keys(currentSubscriptionPayload).length > 0
    ? currentSubscriptionPayload
    : activeTenant || {};

  const displayPlan = currentSubscription.plan || activeTenant?.plan || 'trial';
  const displayStatus = currentSubscription.status || activeTenant?.status || 'active';
  const displaySeats = currentSubscription.seats || 5;
  const displayCurrentPeriodEnd = currentSubscription.currentPeriodEnd || activeTenant?.currentPeriodEnd;

  const isTrialSubscription = displayPlan === 'trial' || displayStatus === 'trialing';
  const subscriptionPlanLabel = displayPlan
    ? displayPlan.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Free';
  const subscriptionStatus = subscriptionBilling?.billingStatus === 'past_due'
    ? 'past_due'
    : subscriptionBilling?.billingStatus === 'grace'
      ? 'grace'
      : displayStatus;

  const currentPeriodEndDate = displayCurrentPeriodEnd
    ? dayjs(displayCurrentPeriodEnd)
    : isTrialSubscription
      ? dayjs().add(30, 'days')
      : null;

  const teamSeatsLabel = loadingUsage
    ? 'Loading...'
    : seatUsage?.isUnlimited
      ? 'Unlimited'
      : `${seatUsage?.limit || displaySeats} seats`;

  return {
    canManageOrganization,
    loadingSubscription,
    loadingSubscriptionPayments,
    subscriptionPlanLabel,
    subscriptionStatus,
    isTrialSubscription,
    currentPeriodEndDate,
    teamSeatsLabel,
    subscriptionPayments,
    activeSubscriptionPayment,
    formatLabel,
    formatMinorCurrency,
  };
};
