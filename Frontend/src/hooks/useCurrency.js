import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { CURRENCIES, CURRENCY } from '../constants';

/**
 * Hook to get the current tenant's currency configuration
 * @returns {{ symbol: string, code: string, name: string, formatAmount: (amount: number) => string }}
 */
export const useCurrency = () => {
  const { activeTenant } = useAuth();
  
  const currency = useMemo(() => {
    const currencyCode = activeTenant?.metadata?.currency || CURRENCY.CODE;
    const found = CURRENCIES.find(c => c.code === currencyCode);
    
    return found || {
      code: CURRENCY.CODE,
      symbol: CURRENCY.SYMBOL,
      name: 'Ghana Cedi',
      country: 'Ghana'
    };
  }, [activeTenant?.metadata?.currency]);

  const formatAmount = useMemo(() => {
    return (amount) => {
      const num = Number(amount);
      const value = Number.isFinite(num) ? num : 0;
      return `${currency.symbol} ${value.toFixed(CURRENCY.DECIMAL_PLACES)}`;
    };
  }, [currency.symbol]);

  return {
    ...currency,
    formatAmount
  };
};

export default useCurrency;
