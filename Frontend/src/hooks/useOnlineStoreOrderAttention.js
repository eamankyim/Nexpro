import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import storeService from '../services/storeService';
import { QUERY_STALE } from '../utils/queryInvalidation';

export const getStoreOrdersPayload = (response) => {
  const payload = response?.data ?? response ?? {};
  if (payload?.success === true || payload?.count != null || payload?.pagination) return payload;
  return payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : payload;
};

export const getOrderStatsPayload = (response) => {
  const payload = response?.data ?? response ?? {};
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data;
  if (payload?.stats && typeof payload.stats === 'object') return payload.stats;
  return payload;
};

export const getStoreOrderRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.data?.orders)) return payload.data.orders;
  return [];
};

const toCount = (value) => {
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

export const getOrderNumber = (order) => order?.saleNumber || order?.orderNumber || order?.orderNo || 'Online order';

export const getCustomerName = (order) => (
  order?.customer?.name
  || order?.customerName
  || order?.customer?.businessName
  || 'Guest customer'
);

/**
 * Shared online-store order attention stats used by Store and main dashboards.
 * Reuses React Query keys so both pages share cached order stats and recent orders.
 * When checklist.hasSettings is false, clears cached operational data so orphaned
 * historical orders cannot leak after an online_store_settings wipe.
 * @param {{ enabled?: boolean }} [options]
 */
export function useOnlineStoreOrderAttention({ enabled = true, commerceChannel = 'online_store' } = {}) {
  const queryClient = useQueryClient();

  const { data: statusResponse, isLoading: isSetupStatusLoading } = useQuery({
    queryKey: ['store', 'setup-status'],
    queryFn: () => storeService.getSetupStatus(),
    enabled,
    staleTime: QUERY_STALE.METADATA,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const setupData = statusResponse?.data ?? statusResponse ?? {};
  const checklist = setupData.checklist || {};
  const hasStoreSettings = Boolean(checklist.hasSettings);

  useEffect(() => {
    if (!enabled || isSetupStatusLoading) return;
    if (!hasStoreSettings) {
      queryClient.removeQueries({ queryKey: ['store', 'dashboard', 'order-stats'] });
      queryClient.removeQueries({ queryKey: ['store', 'dashboard', 'recent-online-orders'] });
      queryClient.removeQueries({ queryKey: ['store', 'online-orders'] });
    }
  }, [enabled, hasStoreSettings, isSetupStatusLoading, queryClient]);

  const {
    data: orderStatsResponse,
    isFetching: isOrderStatsFetching,
  } = useQuery({
    queryKey: ['store', 'dashboard', 'order-stats', commerceChannel],
    queryFn: () => storeService.getOrderStats({ commerceChannel }),
    enabled: enabled && hasStoreSettings,
    staleTime: QUERY_STALE.TRANSACTIONAL,
    refetchInterval: hasStoreSettings ? 60 * 1000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
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
    enabled: enabled && hasStoreSettings,
    staleTime: QUERY_STALE.TRANSACTIONAL,
    refetchInterval: hasStoreSettings ? 60 * 1000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const orderStats = useMemo(
    () => (hasStoreSettings ? getOrderStatsPayload(orderStatsResponse) : EMPTY_ORDER_STATS),
    [hasStoreSettings, orderStatsResponse]
  );

  const recentOrdersPayload = useMemo(
    () => (hasStoreSettings ? getStoreOrdersPayload(recentOrdersResponse) : { data: [] }),
    [hasStoreSettings, recentOrdersResponse]
  );

  const recentOrders = useMemo(
    () => (hasStoreSettings ? getStoreOrderRows(recentOrdersPayload) : []),
    [hasStoreSettings, recentOrdersPayload]
  );

  const pendingOrderCount = useMemo(
    () => (
      toCount(orderStats?.pendingPayment)
      + toCount(orderStats?.pendingFulfillment)
      + toCount(orderStats?.processing)
      + toCount(orderStats?.ready)
      + toCount(orderStats?.outForDelivery)
    ),
    [
      orderStats?.outForDelivery,
      orderStats?.pendingFulfillment,
      orderStats?.pendingPayment,
      orderStats?.processing,
      orderStats?.ready,
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
    hasLoadedOrderStats: hasStoreSettings && orderStatsResponse != null,
    isSetupStatusLoading,
    isOrderStatsFetching: hasStoreSettings && isOrderStatsFetching,
    isRecentOrdersLoading: hasStoreSettings && isRecentOrdersLoading,
    isRecentOrdersFetching: hasStoreSettings && isRecentOrdersFetching,
    isRecentOrdersError: hasStoreSettings && isRecentOrdersError,
  };
}
