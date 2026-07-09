import { useCallback, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { showError, showLoading, showSuccess } from '../utils/toast';
import { DELIVERY_RULE_CATEGORY_LABELS } from '../utils/settingsUtils';

/**
 * Message delivery rules (multi-channel or SMS-only).
 * @param {Object} [options]
 * @param {'sms'|null} [options.channel] - When set, only expose rows/toggles for that channel.
 * @returns {Object}
 */
export const useSettingsDeliveryRules = ({ channel = null } = {}) => {
  const queryClient = useQueryClient();
  const { isManager } = useAuth();
  const canManageOrganization = Boolean(isManager);
  const savingToastDismissRef = useRef(null);

  const { data: messageDeliveryRulesData, isLoading: loadingMessageDeliveryRules } = useQuery({
    queryKey: ['settings', 'message-delivery-rules'],
    queryFn: settingsService.getMessageDeliveryRules,
    enabled: Boolean(isManager),
  });

  const dismissSavingToast = useCallback(() => {
    if (savingToastDismissRef.current) {
      savingToastDismissRef.current();
      savingToastDismissRef.current = null;
    }
  }, []);

  const updateMessageDeliveryRulesMutation = useMutation({
    mutationFn: settingsService.updateMessageDeliveryRules,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('Delivery rules saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'message-delivery-rules'] });
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error, error?.response?.data?.message || error?.message || 'Failed to save delivery rules');
    },
  });

  const deliveryRulesByCategory = useMemo(() => {
    const catalog = messageDeliveryRulesData?.catalog;
    const events = messageDeliveryRulesData?.events;
    if (!Array.isArray(catalog) || !events) return [];
    const grouped = new Map();
    for (const item of catalog) {
      const category = item.category || 'other';
      if (!grouped.has(category)) grouped.set(category, []);
      const channels = events[item.key]?.channels || {};
      const locked = events[item.key]?.locked || {};
      if (channel && !item.allowedChannels?.includes(channel)) continue;
      grouped.get(category).push({
        ...item,
        channels,
        locked,
      });
    }
    return Array.from(grouped.entries()).map(([category, rows]) => ({
      category,
      label: DELIVERY_RULE_CATEGORY_LABELS[category] || category,
      rows,
    }));
  }, [messageDeliveryRulesData, channel]);

  const handleDeliveryRuleToggle = useCallback(
    (eventKey, toggleChannel, checked) => {
      const events = messageDeliveryRulesData?.events;
      if (!events?.[eventKey]) return;
      if (events[eventKey].locked?.[toggleChannel]) return;
      savingToastDismissRef.current = showLoading('Saving...');
      updateMessageDeliveryRulesMutation.mutate({
        events: {
          [eventKey]: {
            channels: {
              ...events[eventKey].channels,
              [toggleChannel]: checked,
            },
          },
        },
      });
    },
    [messageDeliveryRulesData, updateMessageDeliveryRulesMutation]
  );

  return {
    canManageOrganization: Boolean(isManager),
    loadingMessageDeliveryRules,
    deliveryRulesByCategory,
    handleDeliveryRuleToggle,
    updateMessageDeliveryRulesMutation,
    channel,
  };
};
