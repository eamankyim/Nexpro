import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { saleService } from '@/services/saleService';
import { SEARCH_PLACEHOLDERS } from '@/constants/searchPlaceholders';
import { useSmartSearch } from '@/context/SmartSearchContext';
import { useRegisterPageSearch } from '@/hooks/useRegisterPageSearch';
import { useDebounce } from '@/hooks/useDebounce';
import { matchesSearchQuery } from '@/utils/matchesSearchQuery';
import { useAuth } from '@/context/AuthContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { DeliveryStatusPicker } from '@/components/DeliveryStatusPicker';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, SHOP_TYPES, resolveBusinessType } from '@/constants';
import { resolveImageUrl } from '@/utils/fileUtils';
import { showListFilters } from '@/utils/listEmptyLayout';
import { FilterChipRow } from '@/components/FilterChip';
import { ListLoadingState, ListErrorState } from '@/components/ListScreenStates';
import { getApiErrorMessage } from '@/utils/parseApiListResponse';
import { refreshAfterOrderChange } from '@/utils/queryInvalidation';

const POLL_INTERVAL_MS = 12000; // 12 seconds

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);
  if (diffMins >= 60) return `${Math.floor(diffMins / 60)}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  if (diffSecs > 0) return `${diffSecs}s ago`;
  return 'Just now';
}

function groupOrderItems(items: Array<{ productId?: string; name?: string; quantity?: number; product?: { imageUrl?: string } }>) {
  if (!items?.length) return [];
  const map: Record<string, { productId?: string; name: string; quantity: number; imageUrl?: string }> = {};
  items.forEach((i) => {
    const key = i.productId || i.name || 'unknown';
    if (!map[key]) {
      map[key] = {
        productId: i.productId,
        name: i.name || 'Item',
        quantity: 0,
        imageUrl: i.product?.imageUrl,
      };
    }
    map[key].quantity += parseFloat(String(i.quantity ?? 1)) || 1;
    if (!map[key].imageUrl && i.product?.imageUrl) map[key].imageUrl = i.product.imageUrl;
  });
  return Object.values(map);
}

type Order = {
  id: string;
  saleNumber: string;
  orderStatus?: string;
  deliveryStatus?: string | null;
  createdAt: string;
  customer?: { id: string; name?: string };
  items?: Array<{ productId?: string; name?: string; quantity?: number; product?: { imageUrl?: string } }>;
};

type OrderCardProps = {
  order: Order;
  onStatusChange: (order: Order, newStatus: string) => void;
  onDeliveryChange: (order: Order, deliveryStatus: string | null) => void;
  loadingId: string | null;
  deliveryLoadingId: string | null;
  colors: { tint: string };
  cardBg: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
};

function OrderCard({
  order,
  onStatusChange,
  onDeliveryChange,
  loadingId,
  deliveryLoadingId,
  colors,
  cardBg,
  borderColor,
  textColor,
  mutedColor,
}: OrderCardProps) {
  const groupedItems = groupOrderItems(order.items || []);
  const customerName = order.customer?.name || 'Walk-in';
  const timeAgo = formatTimeAgo(order.createdAt);

  return (
    <View style={[styles.orderCard, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.orderHeader}>
        <Text style={[styles.orderNumber, { color: textColor }]} numberOfLines={1}>
          {order.saleNumber}
        </Text>
        <Text style={[styles.timeAgo, { color: mutedColor }]}>{timeAgo}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemsRow}>
        {groupedItems.map((item) => (
          <View key={item.productId || item.name} style={[styles.itemChip, { borderColor, backgroundColor: (cardBg === '#27272a' ? '#3f3f46' : '#f3f4f6') }]}>
            {item.imageUrl ? (
              <Image source={{ uri: resolveImageUrl(item.imageUrl) }} style={styles.itemImage} />
            ) : (
              <View style={[styles.itemImagePlaceholder, { borderColor }]}>
                <AppIcon name="archive" size={16} color={mutedColor} />
              </View>
            )}
            <View>
              <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.itemQty, { color: mutedColor }]}>
                {Number(item.quantity) % 1 === 0 ? item.quantity : parseFloat(String(item.quantity)).toFixed(2)}x
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      {groupedItems.length === 0 && (
        <Text style={[styles.noItems, { color: mutedColor }]}>No items</Text>
      )}
      <View style={styles.customerRow}>
        <AppIcon name="user" size={12} color={mutedColor} />
        <Text style={[styles.customerName, { color: mutedColor }]}>{customerName}</Text>
      </View>
      <View style={styles.actionsRow}>
        {order.orderStatus === ORDER_STATUSES.RECEIVED && (
          <Pressable
            onPress={() => onStatusChange(order, ORDER_STATUSES.PREPARING)}
            disabled={loadingId === order.id}
            style={[styles.actionBtn, { borderColor }]}
          >
            {loadingId === order.id ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <Text style={[styles.actionBtnText, { color: textColor }]}>Start</Text>
            )}
          </Pressable>
        )}
        {order.orderStatus === ORDER_STATUSES.PREPARING && (
          <Pressable
            onPress={() => onStatusChange(order, ORDER_STATUSES.READY)}
            disabled={loadingId === order.id}
            style={[styles.actionBtn, { borderColor }]}
          >
            {loadingId === order.id ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <Text style={[styles.actionBtnText, { color: textColor }]}>Ready</Text>
            )}
          </Pressable>
        )}
        {order.orderStatus === ORDER_STATUSES.READY && (
          <Pressable
            onPress={() => onStatusChange(order, ORDER_STATUSES.COMPLETED)}
            disabled={loadingId === order.id}
            style={[styles.actionBtn, { backgroundColor: colors.tint }]}
          >
            {loadingId === order.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>Complete</Text>
            )}
          </Pressable>
        )}
      </View>
      <View style={[styles.deliveryRow, { borderTopColor: borderColor }]}>
        <Text style={[styles.deliveryLabel, { color: mutedColor }]}>Delivery</Text>
        <DeliveryStatusPicker
          value={order.deliveryStatus}
          onChange={(value) => onDeliveryChange(order, value)}
          cardBg={cardBg}
          borderColor={borderColor}
          textColor={textColor}
          mutedColor={mutedColor}
          tintColor={colors.tint}
          loading={deliveryLoadingId === order.id}
          disabled={loadingId === order.id}
        />
      </View>
    </View>
  );
}

const KITCHEN_COLUMNS = [
  { key: ORDER_STATUSES.RECEIVED, label: 'Received' },
  { key: ORDER_STATUSES.PREPARING, label: 'Preparing' },
  { key: ORDER_STATUSES.READY, label: 'Ready' },
] as const;

export default function OrdersScreen() {
  const { activeTenant, activeTenantId, hasFeature } = useAuth();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor, inputBg } = useScreenColors();
  const queryClient = useQueryClient();

  const shopType = activeTenant?.metadata?.shopType;
  const isShop = resolveBusinessType(activeTenant?.businessType) === 'shop';
  const isRestaurant = isShop && shopType === SHOP_TYPES.RESTAURANT;

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deliveryLoadingId, setDeliveryLoadingId] = useState<string | null>(null);

  const { searchValue } = useSmartSearch();
  useRegisterPageSearch({ scope: 'orders', placeholder: SEARCH_PLACEHOLDERS.ORDERS });
  const debouncedSearch = useDebounce(searchValue, 400);

  const today = new Date().toISOString().split('T')[0];

  const fetchOrders = useCallback(async () => {
    if (!isRestaurant) return { data: [] };
    const params: { activeOrders: boolean; startDate: string; endDate: string; orderStatus?: string; limit: number } = {
      activeOrders: true,
      startDate: today,
      endDate: today,
      limit: 100,
    };
    if (statusFilter !== 'all') params.orderStatus = statusFilter;
    const res = await saleService.getOrders(params);
    return res;
  }, [isRestaurant, statusFilter, today]);

  const { data: response, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['orders', activeTenantId, statusFilter, today],
    queryFn: fetchOrders,
    enabled: !!activeTenantId && isRestaurant && hasFeature('orders'),
    staleTime: 5000, // 5 sec - keep relatively fresh
    refetchInterval: POLL_INTERVAL_MS,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, orderStatus }: { orderId: string; orderStatus: string }) =>
      saleService.updateOrderStatus(orderId, orderStatus),
    onSuccess: async (_, variables) => {
      await refreshAfterOrderChange(queryClient);
      setLoadingId(null);
      Alert.alert('Success', `Order moved to ${ORDER_STATUS_LABELS[variables.orderStatus] || variables.orderStatus}`);
    },
    onError: (error: any) => {
      setLoadingId(null);
      Alert.alert('Error', error?.response?.data?.error || error?.message || 'Failed to update order');
    },
  });

  const handleStatusChange = useCallback(
    (order: Order, newStatus: string) => {
      setLoadingId(order.id);
      updateStatusMutation.mutate({ orderId: order.id, orderStatus: newStatus });
    },
    [updateStatusMutation]
  );

  const updateDeliveryMutation = useMutation({
    mutationFn: ({ orderId, deliveryStatus }: { orderId: string; deliveryStatus: string | null }) =>
      saleService.updateDeliveryStatus(orderId, deliveryStatus),
    onSuccess: async () => {
      await refreshAfterOrderChange(queryClient);
      setDeliveryLoadingId(null);
      Alert.alert('Success', 'Delivery status updated');
    },
    onError: (error: any) => {
      setDeliveryLoadingId(null);
      Alert.alert('Error', error?.response?.data?.error || error?.message || 'Failed to update delivery');
    },
  });

  const handleDeliveryChange = useCallback(
    (order: Order, deliveryStatus: string | null) => {
      setDeliveryLoadingId(order.id);
      updateDeliveryMutation.mutate({ orderId: order.id, deliveryStatus });
    },
    [updateDeliveryMutation]
  );

  const orders = useMemo(() => {
    const list = (response?.data || []) as Order[];
    if (!debouncedSearch.trim()) return list;
    return list.filter((order) =>
      matchesSearchQuery(debouncedSearch, [order.saleNumber, order.customer?.name])
    );
  }, [response, debouncedSearch]);
  const rawOrders = useMemo(() => ((response?.data || []) as Order[]), [response]);
  const ordersByStatus = useMemo(() => {
    const map: Record<string, Order[]> = {
      [ORDER_STATUSES.RECEIVED]: [],
      [ORDER_STATUSES.PREPARING]: [],
      [ORDER_STATUSES.READY]: [],
    };
    orders.forEach((order) => {
      if (order.orderStatus && map[order.orderStatus]) {
        map[order.orderStatus].push(order);
      }
    });
    return map;
  }, [orders]);
  const statusCounts = useMemo(
    () => ({
      received: ordersByStatus[ORDER_STATUSES.RECEIVED]?.length ?? 0,
      preparing: ordersByStatus[ORDER_STATUSES.PREPARING]?.length ?? 0,
      ready: ordersByStatus[ORDER_STATUSES.READY]?.length ?? 0,
    }),
    [ordersByStatus]
  );
  const hasActiveFilter = statusFilter !== 'all' || !!debouncedSearch.trim();
  const onRefresh = useCallback(() => refetch(), [refetch]);
  const showGrouped = statusFilter === 'all' && !debouncedSearch.trim();

  const loadErrorMessage = useMemo(
    () => getApiErrorMessage(error, 'Could not load kitchen orders. Pull to refresh.'),
    [error]
  );

  const orderFilterOptions = useMemo(
    () => [
      { value: 'all', label: `All (${rawOrders.length})` },
      {
        value: ORDER_STATUSES.RECEIVED,
        label: `${ORDER_STATUS_LABELS[ORDER_STATUSES.RECEIVED] || ORDER_STATUSES.RECEIVED} (${statusCounts.received})`,
      },
      {
        value: ORDER_STATUSES.PREPARING,
        label: `${ORDER_STATUS_LABELS[ORDER_STATUSES.PREPARING] || ORDER_STATUSES.PREPARING} (${statusCounts.preparing})`,
      },
      {
        value: ORDER_STATUSES.READY,
        label: `${ORDER_STATUS_LABELS[ORDER_STATUSES.READY] || ORDER_STATUSES.READY} (${statusCounts.ready})`,
      },
    ],
    [rawOrders.length, statusCounts]
  );

  const handleOrderFilterChange = useCallback((value: string) => {
    setStatusFilter((prev) => (prev === value && value !== 'all' ? 'all' : value));
  }, []);


  if (!isRestaurant) {
    return <FeatureAccessDenied message="Kitchen orders are only available for restaurant shops." />;
  }

  if (!hasFeature('orders')) {
    return <FeatureAccessDenied message="Kitchen orders are not enabled for this workspace." />;
  }

  return (
    <ScreenShell style={styles.container}>
      {showListFilters(isLoading, isError, rawOrders.length, hasActiveFilter) && (
        <View style={[styles.filterRow, { borderColor }]}>
          <View style={styles.filterChipsWrap}>
            <FilterChipRow
              options={orderFilterOptions}
              value={statusFilter}
              onChange={handleOrderFilterChange}
            />
          </View>
          <Pressable onPress={onRefresh} disabled={isLoading} style={[styles.refreshBtn, { borderColor }]}>
            {isRefetching ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <AppIcon name="refresh" size={18} color={colors.tint} />
            )}
          </Pressable>
        </View>
      )}

      {isLoading && !response ? (
        <ListLoadingState message="Loading orders..." />
      ) : isError ? (
        <ListErrorState title="Failed to load orders" message={loadErrorMessage} onRetry={refetch} />
      ) : showGrouped ? (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
        >
          {orders.length === 0 ? (
            <View style={styles.empty}>
              <AppIcon name="cutlery" size={48} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No active orders</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                New orders from POS will appear here
              </Text>
            </View>
          ) : (
            KITCHEN_COLUMNS.map((col) => {
              const columnOrders = ordersByStatus[col.key] ?? [];
              return (
                <View key={col.key} style={styles.kitchenSection}>
                  <View style={styles.kitchenSectionHeader}>
                    <Text style={[styles.kitchenSectionTitle, { color: textColor }]}>{col.label}</Text>
                    <View style={[styles.kitchenCountBadge, { backgroundColor: colors.tint + '20' }]}>
                      <Text style={[styles.kitchenCountText, { color: colors.tint }]}>{columnOrders.length}</Text>
                    </View>
                  </View>
                  {columnOrders.length === 0 ? (
                    <Text style={[styles.kitchenSectionEmpty, { color: mutedColor }]}>No orders</Text>
                  ) : (
                    columnOrders.map((item) => (
                      <OrderCard
                        key={item.id}
                        order={item}
                        onStatusChange={handleStatusChange}
                        onDeliveryChange={handleDeliveryChange}
                        loadingId={loadingId}
                        deliveryLoadingId={deliveryLoadingId}
                        colors={colors}
                        cardBg={cardBg}
                        borderColor={borderColor}
                        textColor={textColor}
                        mutedColor={mutedColor}
                      />
                    ))
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onStatusChange={handleStatusChange}
              onDeliveryChange={handleDeliveryChange}
              loadingId={loadingId}
              deliveryLoadingId={deliveryLoadingId}
              colors={colors}
              cardBg={cardBg}
              borderColor={borderColor}
              textColor={textColor}
              mutedColor={mutedColor}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <AppIcon name="cutlery" size={48} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No active orders</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                New orders from POS will appear here
              </Text>
            </View>
          }
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    paddingVertical: 4,
    borderBottomWidth: 1,
    gap: 8,
  },
  filterChipsWrap: {
    flex: 1,
    minWidth: 0,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: { fontSize: 14, fontWeight: '500' },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { padding: 16, paddingBottom: 32 },
  orderCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: { fontSize: 16, fontWeight: '600' },
  timeAgo: { fontSize: 12 },
  itemsRow: { marginBottom: 8 },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    minWidth: 100,
  },
  itemImage: { width: 36, height: 36, borderRadius: 6, marginRight: 8 },
  itemImagePlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  itemName: { fontSize: 13, fontWeight: '500' },
  itemQty: { fontSize: 11 },
  noItems: { fontSize: 13, marginBottom: 8 },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  customerName: { fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  deliveryRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  deliveryLabel: { fontSize: 12, fontWeight: '500' },
  kitchenSection: { marginBottom: 20 },
  kitchenSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kitchenSectionTitle: { fontSize: 16, fontWeight: '700' },
  kitchenCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  kitchenCountText: { fontSize: 13, fontWeight: '700' },
  kitchenSectionEmpty: { fontSize: 13, marginBottom: 8, fontStyle: 'italic' },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },
});
