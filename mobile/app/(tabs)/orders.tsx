import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { saleService } from '@/services/saleService';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, SHOP_TYPES } from '@/constants';
import { resolveImageUrl } from '@/utils/fileUtils';

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
  createdAt: string;
  customer?: { id: string; name?: string };
  items?: Array<{ productId?: string; name?: string; quantity?: number; product?: { imageUrl?: string } }>;
};

type OrderCardProps = {
  order: Order;
  onStatusChange: (order: Order, newStatus: string) => void;
  loadingId: string | null;
  colors: { tint: string };
  cardBg: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
};

function OrderCard({ order, onStatusChange, loadingId, colors, cardBg, borderColor, textColor, mutedColor }: OrderCardProps) {
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
                <FontAwesome name="archive" size={16} color={mutedColor} />
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
        <FontAwesome name="user" size={12} color={mutedColor} />
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
            style={[styles.actionBtn, { backgroundColor: '#166534' }]}
          >
            {loadingId === order.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>Complete</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const { activeTenant, activeTenantId } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const queryClient = useQueryClient();

  const shopType = activeTenant?.metadata?.shopType;
  const isRestaurant = shopType === SHOP_TYPES.RESTAURANT;

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

  const { data: response, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['orders', activeTenantId, statusFilter, today],
    queryFn: fetchOrders,
    enabled: !!activeTenantId && isRestaurant,
    staleTime: 5000, // 5 sec - keep relatively fresh
    refetchInterval: POLL_INTERVAL_MS,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, orderStatus }: { orderId: string; orderStatus: string }) =>
      saleService.updateOrderStatus(orderId, orderStatus),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
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

  const orders = (response?.data || []) as Order[];
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  if (!isRestaurant) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: bg }]}>
        <FontAwesome name="cutlery" size={48} color={mutedColor} />
        <Text style={[styles.emptyTitle, { color: textColor }]}>Kitchen Orders</Text>
        <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
          Order tracking is only available for restaurant tenants.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.filterRow, { borderColor }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[ORDER_STATUSES.RECEIVED, ORDER_STATUSES.PREPARING, ORDER_STATUSES.READY].map((status) => (
            <Pressable
              key={status}
              onPress={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              style={[
                styles.filterChip,
                { borderColor, backgroundColor: statusFilter === status ? colors.tint : 'transparent' },
              ]}
            >
              <Text
                style={[styles.filterChipText, { color: statusFilter === status ? '#fff' : textColor }]}
              >
                {ORDER_STATUS_LABELS[status] || status}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={onRefresh} disabled={isLoading} style={[styles.refreshBtn, { borderColor }]}>
          {isRefetching ? (
            <ActivityIndicator size="small" color={colors.tint} />
          ) : (
            <FontAwesome name="refresh" size={18} color={colors.tint} />
          )}
        </Pressable>
      </View>

      {isLoading && orders.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: mutedColor }]}>Loading orders...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onStatusChange={handleStatusChange}
              loadingId={loadingId}
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
              <FontAwesome name="cutlery" size={48} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No active orders</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                New orders from POS will appear here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 8,
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
