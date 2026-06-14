import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import storeService from '../services/storeService';

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
 * @param {{ enabled?: boolean }} [options]
 * @returns {{
 *   hasStoreSettings: boolean,
 *   pendingOrderCount: number,
 *   latestOrder: object|null,
 *   showBanner: boolean,
 *   recentOrders: object[],
 *   isOrderStatsFetching: boolean,
 *   isRecentOrdersLoading: boolean,
 *   isRecentOrdersFetching: boolean,
 *   isRecentOrdersError: boolean,
 * }}
 */
export function useOnlineStoreOrderAttention({ enabled = true } = {}) {
  const { data: statusResponse, isLoading: isSetupStatusLoading } = useQuery({
    queryKey: ['store', 'setup-status'],
    queryFn: () => storeService.getSetupStatus(),
    enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const setupData = statusResponse?.data ?? statusResponse ?? {};
  const checklist = setupData.checklist || {};
  const hasStoreSettings = Boolean(checklist.hasSettings);

  const {
    data: orderStatsResponse,
    isFetching: isOrderStatsFetching,
  } = useQuery({
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

  const orderStats = useMemo(
    () => getOrderStatsPayload(orderStatsResponse),
    [orderStatsResponse]
  );

  const recentOrdersPayload = useMemo(
    () => getStoreOrdersPayload(recentOrdersResponse),
    [recentOrdersResponse]
  );

  const recentOrders = useMemo(
    () => getStoreOrderRows(recentOrdersPayload),
    [recentOrdersPayload]
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
    hasLoadedOrderStats: orderStatsResponse != null,
    isSetupStatusLoading,
    isOrderStatsFetching,
    isRecentOrdersLoading,
    isRecentOrdersFetching,
    isRecentOrdersError,
  };
}
