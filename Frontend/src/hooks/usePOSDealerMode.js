import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';
import { useAuth } from '../context/AuthContext';
import dealerService from '../services/dealerService';
import { DEBOUNCE_DELAYS } from '../constants';
import { formatAmount } from '../utils/formatNumber';

/**
 * POS dealer-first mode: dealer selection, balance display, and branch-scoped price resolution.
 */
export function usePOSDealerMode({ activeShopId, enabled = true }) {
  const { hasFeature, isManager, isAdmin } = useAuth();
  const dealersEnabled = enabled && hasFeature('dealersAccount');
  const [posSaleMode, setPosSaleMode] = useState('retail');
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [dealerSearch, setDealerSearch] = useState('');
  const debouncedDealerSearch = useDebounce(dealerSearch, DEBOUNCE_DELAYS.SEARCH);

  const isDealerMode = dealersEnabled && posSaleMode === 'dealer';
  const canOverrideCredit = isManager || isAdmin;

  const { data: dealerSearchData, isLoading: dealerSearchLoading } = useQuery({
    queryKey: ['dealers', 'pos-search', debouncedDealerSearch],
    queryFn: () => dealerService.posSearch({ search: debouncedDealerSearch, limit: 20 }),
    enabled: dealersEnabled && isDealerMode,
    staleTime: 30_000,
  });

  const dealerOptions = useMemo(() => {
    const rows = dealerSearchData?.data?.data || dealerSearchData?.data || [];
    return Array.isArray(rows) ? rows : [];
  }, [dealerSearchData]);

  const dealerSummary = useMemo(() => {
    if (!selectedDealer) return null;
    const balance = parseFloat(selectedDealer.balance || 0);
    const creditLimit = parseFloat(selectedDealer.creditLimit || 0);
    const availableCredit = Math.max(creditLimit - balance, 0);
    return {
      balance,
      creditLimit,
      availableCredit,
      balanceLabel: formatAmount(balance),
      availableCreditLabel: formatAmount(availableCredit),
    };
  }, [selectedDealer]);

  const switchPosSaleMode = useCallback((mode) => {
    setPosSaleMode(mode === 'dealer' ? 'dealer' : 'retail');
    if (mode !== 'dealer') {
      setSelectedDealer(null);
      setDealerSearch('');
    }
  }, []);

  const selectDealer = useCallback((dealer) => {
    setSelectedDealer(dealer || null);
  }, []);

  const clearDealerSelection = useCallback(() => {
    setSelectedDealer(null);
    setDealerSearch('');
  }, []);

  const resolveDealerUnitPrice = useCallback(async (productId, productVariantId = null) => {
    if (!selectedDealer?.id || !activeShopId) return null;
    const res = await dealerService.resolvePrice(selectedDealer.id, {
      shopId: activeShopId,
      productId,
      productVariantId: productVariantId || undefined,
    });
    return res?.data?.data || res?.data || null;
  }, [selectedDealer?.id, activeShopId]);

  const applyDealerPriceToItem = useCallback(async (item) => {
    if (!isDealerMode || !selectedDealer?.id || !item?.productId) {
      return item;
    }
    try {
      const resolved = await resolveDealerUnitPrice(item.productId, item.productVariantId);
      if (resolved?.unitPrice != null) {
        const dealerUnit = parseFloat(resolved.unitPrice);
        const retailUnit = resolved.retailPrice != null
          ? parseFloat(resolved.retailPrice)
          : parseFloat(item.unitPrice ?? item.catalogUnitPrice ?? 0);
        return {
          ...item,
          unitPrice: dealerUnit,
          baseUnitPrice: dealerUnit,
          catalogUnitPrice: dealerUnit,
          retailUnitPrice: Number.isFinite(retailUnit) ? retailUnit : undefined,
          priceOverridden: false,
          dealerPriceSource: resolved.source,
        };
      }
    } catch {
      // Fall back to retail price already on the item
    }
    return item;
  }, [isDealerMode, selectedDealer?.id, resolveDealerUnitPrice]);

  return {
    dealersEnabled,
    posSaleMode,
    isDealerMode,
    switchPosSaleMode,
    selectedDealer,
    selectDealer,
    clearDealerSelection,
    dealerSearch,
    setDealerSearch,
    dealerOptions,
    dealerSearchLoading,
    dealerSummary,
    canOverrideCredit,
    applyDealerPriceToItem,
    resolveDealerUnitPrice,
  };
}

export default usePOSDealerMode;
