import { useQuery } from '@tanstack/react-query';
import settingsService from '../services/settingsService';

const POS_CONFIG_DEFAULTS = {
  receipt: { mode: 'ask', channels: ['sms', 'print'] },
  print: { format: 'a4', showLogo: true, color: true, fontSize: 'normal' },
  customer: { phoneRequired: false, nameRequired: false },
};

/**
 * Fetches POS/checkout configuration from settings
 * @returns {{ posConfig: Object, isLoading: boolean }}
 */
export const usePOSConfig = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'pos-config'],
    queryFn: settingsService.getPOSConfig,
    staleTime: 5 * 60 * 1000,
  });

  const posConfig = data?.data
    ? {
        receipt: { ...POS_CONFIG_DEFAULTS.receipt, ...(data.data.receipt || {}) },
        print: { ...POS_CONFIG_DEFAULTS.print, ...(data.data.print || {}) },
        customer: { ...POS_CONFIG_DEFAULTS.customer, ...(data.data.customer || {}) },
        receiptChannelsAvailable: data.data.receiptChannelsAvailable || { sms: false, whatsapp: false, email: false },
      }
    : { ...POS_CONFIG_DEFAULTS, receiptChannelsAvailable: { sms: false, whatsapp: false, email: false } };

  return { posConfig, isLoading };
};
