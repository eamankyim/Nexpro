import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { storeService } from '@/services/storeService';
import {
  getOrderStatsPayload,
  getStoreOrderRows,
  getStoreOrdersPayload,
} from '@/utils/marketplaceOrderStatus';

const toCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

type UseOnlineStoreOrderAttentionOptions = {
  enabled?: boolean;
};

/**
 * Shared online-store order attention stats for dashboard and store screens.
 */
export function useOnlineStoreOrderAttention({ enabled = true }: UseOnlineStoreOrderAttentionOptions = {}) {
  const { data: statusResponse, isLoading: isSetupStatusLoading } = useQuery({
    queryKey: ['store', 'setup-status'],
    queryFn: () => storeService.getSetupStatus(),
    enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const setupData = (statusResponse as { data?: unknown })?.data ?? statusResponse ?? {};
  const checklist = (setupData as { checklist?: Record<string, unknown> }).checklist || {};
  const hasStoreSettings = Boolean(checklist.hasSettings);

  const { data: orderStatsResponse, isFetching: isOrderStatsFetching } = useQuery({
    queryKey: ['store', 'dashboard', 'order-stats'],
    queryFn: () => storeService.getOrderStats(),
    enabled: enabled && hasStoreSettings,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const {
    data: recentOrdersResponse,
    isFetching: isRecentOrdersFetching,
    isLoading: isRecentOrdersLoading,
    isError: isRecentOrdersError,
  } = useQuery({
    queryKey: ['store', 'dashboard', 'recent-online-orders'],
    queryFn: () => storeService.getOrders({ limit: 5 }),
    enabled: enabled && hasStoreSettings,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const orderStats = useMemo(() => getOrderStatsPayload(orderStatsResponse), [orderStatsResponse]);
  const recentOrdersPayload = useMemo(
    () => getStoreOrdersPayload(recentOrdersResponse),
    [recentOrdersResponse]
  );
  const recentOrders = useMemo(
    () => getStoreOrderRows(recentOrdersPayload),
    [recentOrdersPayload]
  );

  const pendingOrderCount = useMemo(
    () =>
      toCount(orderStats.pendingPayment)
      + toCount(orderStats.pendingFulfillment)
      + toCount(orderStats.processing)
      + toCount(orderStats.ready)
      + toCount(orderStats.outForDelivery),
    [
      orderStats.outForDelivery,
      orderStats.pendingFulfillment,
      orderStats.pendingPayment,
      orderStats.processing,
      orderStats.ready,
    ]
  );

  const latestOrder = recentOrders[0] || null;
  const showBanner = hasStoreSettings && pendingOrderCount > 0;

  return {
    hasStoreSettings,
    pendingOrderCount,
    latestOrder,
    showBanner,
    recentOrders,
    orderStats,
    checklist,
    setupData,
    hasLoadedOrderStats: orderStatsResponse != null,
    isSetupStatusLoading,
    isOrderStatsFetching,
    isRecentOrdersLoading,
    isRecentOrdersFetching,
    isRecentOrdersError,
  };
}
