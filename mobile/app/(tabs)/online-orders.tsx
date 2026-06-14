import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { AppIcon } from '@/components/AppIcon';
import { ListEmptyState } from '@/components/ListEmptyState';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { FilterChipRow } from '@/components/FilterChip';
import { ListLoadingState, ListErrorState } from '@/components/ListScreenStates';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/context/AuthContext';
import { useWorkspaceScope } from '@/hooks/useWorkspaceScope';
import { useScreenColors } from '@/hooks/useScreenColors';
import { useSmartSearch } from '@/context/SmartSearchContext';
import { useRegisterPageSearch } from '@/hooks/useRegisterPageSearch';
import { useDebounce } from '@/hooks/useDebounce';
import { storeService } from '@/services/storeService';
import { formatCurrency } from '@/utils/formatCurrency';
import { getApiErrorMessage } from '@/utils/parseApiListResponse';
import { flatListStyleForEmpty, listContentStyleWhenEmpty, showListFilters } from '@/utils/listEmptyLayout';
import { QUERY_STALE } from '@/utils/queryInvalidation';
import { SEARCH_PLACEHOLDERS } from '@/constants/searchPlaceholders';
import {
  fulfillmentStateForOrder,
  formatOnlineOrderStatusLabel,
  getCustomerName,
  getOnlineOrderStatusColors,
  getOrderNumber,
  getOrderTotal,
  getStoreOrderRows,
  getStoreOrdersPayload,
  ONLINE_ORDER_STATUS_FILTERS,
  paymentStatusForMarketplaceOrder,
} from '@/utils/marketplaceOrderStatus';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type TradeAssuranceSummary = {
  heldBalance?: number;
  availableBalance?: number;
  totalFees?: number;
  openDisputes?: number;
};

export default function OnlineOrdersScreen() {
  const router = useRouter();
  const { activeTenantId, hasFeature } = useAuth();
  const { activeShopId, activeStudioLocationId, scopeReady } = useWorkspaceScope();
  const { colors, cardBg, borderColor, textColor, mutedColor, resolvedTheme } = useScreenColors();

  const [statusFilter, setStatusFilter] = useState('all');
  const { searchValue } = useSmartSearch();
  useRegisterPageSearch({ scope: 'online-orders', placeholder: SEARCH_PLACEHOLDERS.ONLINE_ORDERS });
  const debouncedSearch = useDebounce(searchValue, 400);

  const enabled = !!activeTenantId && scopeReady && hasFeature('paymentsExpenses');

  const { data: tradeAssuranceRes } = useQuery({
    queryKey: ['store', 'trade-assurance', activeTenantId, activeShopId, activeStudioLocationId],
    queryFn: () => storeService.getTradeAssuranceDashboard(),
    enabled,
    staleTime: QUERY_STALE.TRANSACTIONAL,
  });

  const tradeAssurance: TradeAssuranceSummary = useMemo(() => {
    const body = (tradeAssuranceRes as { data?: unknown })?.data ?? tradeAssuranceRes ?? {};
    const data = (body as { data?: TradeAssuranceSummary }).data ?? body;
    return data as TradeAssuranceSummary;
  }, [tradeAssuranceRes]);

  const {
    data: pagesData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['store', 'online-orders', activeTenantId, activeShopId, activeStudioLocationId, statusFilter],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { page: pageParam, limit: 20 };
      if (statusFilter !== 'all') params.fulfillmentStatus = statusFilter;
      const response = await storeService.getOrders(params);
      return getStoreOrdersPayload(response);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = (lastPage.pagination || {}) as { page?: number; totalPages?: number };
      const page = Number(pagination.page || 1);
      const totalPages = Number(pagination.totalPages || 1);
      return page < totalPages ? page + 1 : undefined;
    },
    enabled,
    staleTime: QUERY_STALE.TRANSACTIONAL,
  });

  const orders = useMemo(() => {
    const allPages = pagesData?.pages ?? [];
    return allPages.flatMap((page) => getStoreOrderRows(page));
  }, [pagesData]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => {
      const blob = [
        getOrderNumber(order),
        getCustomerName(order),
        order.customerPhone,
        order.status,
        order.orderStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [orders, debouncedSearch]);

  const onRefresh = useCallback(() => refetch(), [refetch]);
  const loadErrorMessage = getApiErrorMessage(error, 'Could not load online orders.');

  if (!hasFeature('paymentsExpenses')) {
    return <FeatureAccessDenied message="Online orders are not enabled for your workspace." />;
  }

  const renderTradeAssurance = () => {
    const hasData =
      tradeAssurance.heldBalance != null
      || tradeAssurance.availableBalance != null
      || tradeAssurance.totalFees != null;
    if (!hasData) return null;

    return (
      <View style={styles.taRow}>
        <View style={[styles.taCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.taLabel, { color: mutedColor }]}>Held</Text>
          <Text style={[styles.taValue, { color: '#b45309' }]}>
            {formatCurrency(tradeAssurance.heldBalance || 0)}
          </Text>
        </View>
        <View style={[styles.taCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.taLabel, { color: mutedColor }]}>Available</Text>
          <Text style={[styles.taValue, { color: '#15803d' }]}>
            {formatCurrency(tradeAssurance.availableBalance || 0)}
          </Text>
        </View>
        <View style={[styles.taCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.taLabel, { color: mutedColor }]}>Fees</Text>
          <Text style={[styles.taValue, { color: textColor }]}>
            {formatCurrency(tradeAssurance.totalFees || 0)}
          </Text>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Record<string, unknown> }) => {
    const fulfillment = fulfillmentStateForOrder(item);
    const statusColors = getOnlineOrderStatusColors(fulfillment);
    const paymentStatus = paymentStatusForMarketplaceOrder(item);
    const paymentColors = paymentStatus ? getOnlineOrderStatusColors(paymentStatus) : null;

    return (
      <Pressable
        onPress={() => router.push(`/store-order/${item.id}` as never)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: cardBg, borderColor },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.orderNo, { color: textColor }]} numberOfLines={1}>
            {getOrderNumber(item)}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {formatOnlineOrderStatusLabel(fulfillment, 'fulfillment')}
            </Text>
          </View>
        </View>
        <Text style={[styles.customer, { color: textColor }]} numberOfLines={1}>
          {getCustomerName(item)}
        </Text>
        <View style={styles.cardBottom}>
          <Text style={[styles.meta, { color: mutedColor }]}>
            {formatDate(String(item.createdAt || item.orderDate || ''))}
          </Text>
          <Text style={[styles.total, { color: colors.tint }]}>
            {formatCurrency(getOrderTotal(item))}
          </Text>
        </View>
        {paymentStatus && paymentColors ? (
          <View style={[styles.paymentPill, { backgroundColor: paymentColors.bg, borderColor: paymentColors.border }]}>
            <AppIcon name="lock" size={12} color={paymentColors.text} />
            <Text style={[styles.paymentText, { color: paymentColors.text }]}>
              {formatOnlineOrderStatusLabel(paymentStatus, 'payment')}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const isEmpty = filtered.length === 0;
  const hasActiveFilter = statusFilter !== 'all' || !!debouncedSearch.trim();
  const showFilters = showListFilters(isLoading, isError, orders.length, hasActiveFilter);

  return (
    <ScreenShell style={styles.container}>
      {isLoading ? (
        <ListLoadingState message="Loading online orders..." />
      ) : isError ? (
        <ListErrorState title="Failed to load" message={loadErrorMessage} onRetry={refetch} />
      ) : (
        <FlatList
          style={flatListStyleForEmpty}
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={listContentStyleWhenEmpty(styles.list, isEmpty)}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <>
              {renderTradeAssurance()}
              {showFilters ? (
                <FilterChipRow
                  options={ONLINE_ORDER_STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              ) : null}
            </>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator style={styles.footerLoader} color={colors.tint} />
            ) : null
          }
          ListEmptyComponent={
            <ListEmptyState
              imageKey="SALES"
              title="No online orders"
              subtitle={
                statusFilter !== 'all' || debouncedSearch.trim()
                  ? 'Try a different filter or search'
                  : 'Orders from your online store will appear here'
              }
            />
          }
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 32 },
  taRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  taCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  taLabel: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  taValue: { fontSize: 14, fontWeight: '700' },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  pressed: { opacity: 0.85 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderNo: { fontSize: 15, fontWeight: '700', flex: 1 },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  customer: { fontSize: 14, marginTop: 6 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  meta: { fontSize: 12 },
  total: { fontSize: 15, fontWeight: '700' },
  paymentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  paymentText: { fontSize: 11, fontWeight: '600' },
  footerLoader: { paddingVertical: 16 },
});
