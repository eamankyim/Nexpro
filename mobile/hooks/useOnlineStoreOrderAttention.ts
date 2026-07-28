import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useIsStoreSetupRoute } from '@/hooks/useIsStoreSetupRoute';
import { ONLINE_STORE_COMMERCE_CHANNEL, storeService } from '@/services/storeService';
import {
  getOrderStatsPayload,
  getStoreOrderRows,
  getStoreOrdersPayload,
} from '@/utils/marketplaceOrderStatus';
import { clearOnlineStoreOperationalQueries } from '@/utils/queryInvalidation';

const toCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const EMPTY_ORDER_STATS = {
  total: 0,
  pendingPayment: 0,
  pendingFulfillment: 0,
  processing: 0,
  ready: 0,
  outForDelivery: 0,
  totalRevenue: 0,
};

type UseOnlineStoreOrderAttentionOptions = {
  enabled?: boolean;
  /** Defaults to ABS Online Store; pass sabito_marketplace for Sabito surfaces. */
  commerceChannel?: string;
};

/**
 * Shared online-store order attention stats for dashboard and store screens.
 * When checklist.hasSettings is false (settings wiped / not set up), order APIs
 * stay disabled and any cached order/stats data is cleared so orphaned Sabito
 * or historical online_store rows cannot leak into the UI.
 * Paused while the store-setup wizard is focused so setup stays responsive.
 */
export function useOnlineStoreOrderAttention({
  enabled = true,
  commerceChannel = ONLINE_STORE_COMMERCE_CHANNEL,
}: UseOnlineStoreOrderAttentionOptions = {}) {
  const queryClient = useQueryClient();
  const inStoreSetup = useIsStoreSetupRoute();
  const queriesEnabled = enabled && !inStoreSetup;

  const { data: statusResponse, isLoading: isSetupStatusLoading } = useQuery({
    queryKey: ['store', 'setup-status'],
    queryFn: () => storeService.getSetupStatus(),
    enabled: queriesEnabled,
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
    retry: 1,
  });

  const setupData = (statusResponse as { data?: unknown })?.data ?? statusResponse ?? {};
  const checklist = (setupData as { checklist?: Record<string, unknown> }).checklist || {};
  const hasStoreSettings = Boolean(checklist.hasSettings);

  useEffect(() => {
    if (!queriesEnabled || isSetupStatusLoading) return;
    if (!hasStoreSettings) {
      void clearOnlineStoreOperationalQueries(queryClient);
    }
  }, [queriesEnabled, hasStoreSettings, isSetupStatusLoading, queryClient]);

  const { data: orderStatsResponse, isFetching: isOrderStatsFetching } = useQuery({
    queryKey: ['store', 'dashboard', 'order-stats', commerceChannel],
    queryFn: () => storeService.getOrderStats({ commerceChannel }),
    enabled: queriesEnabled && hasStoreSettings,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const {
    data: recentOrdersResponse,
    isFetching: isRecentOrdersFetching,
    isLoading: isRecentOrdersLoading,
    isError: isRecentOrdersError,
  } = useQuery({
    queryKey: ['store', 'dashboard', 'recent-online-orders', commerceChannel],
    queryFn: () => storeService.getOrders({ limit: 5, commerceChannel }),
    enabled: queriesEnabled && hasStoreSettings,
    staleTime: 60 * 1000,
    refetchInterval: queriesEnabled && hasStoreSettings ? 60 * 1000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const orderStats = useMemo(() => {
    if (!hasStoreSettings) return EMPTY_ORDER_STATS;
    return getOrderStatsPayload(orderStatsResponse);
  }, [hasStoreSettings, orderStatsResponse]);

  const recentOrdersPayload = useMemo(
    () => (hasStoreSettings ? getStoreOrdersPayload(recentOrdersResponse) : { data: [] }),
    [hasStoreSettings, recentOrdersResponse]
  );
  const recentOrders = useMemo(
    () => (hasStoreSettings ? getStoreOrderRows(recentOrdersPayload) : []),
    [hasStoreSettings, recentOrdersPayload]
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
    hasLoadedOrderStats: hasStoreSettings && orderStatsResponse != null,
    isSetupStatusLoading,
    isOrderStatsFetching: hasStoreSettings && isOrderStatsFetching,
    isRecentOrdersLoading: hasStoreSettings && isRecentOrdersLoading,
    isRecentOrdersFetching: hasStoreSettings && isRecentOrdersFetching,
    isRecentOrdersError: hasStoreSettings && isRecentOrdersError,
  };
}
