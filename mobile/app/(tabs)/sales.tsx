import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { useTheme } from '@/context/ThemeContext';
import { saleService } from '@/services/saleService';
import { CURRENCY } from '@/constants';
import Colors from '@/constants/Colors';
import { resolveBusinessType } from '@/constants';

function formatCurrency(value: number | string | null | undefined): string {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value ?? 0)) || 0;
  return `${CURRENCY.SYMBOL} ${numValue.toFixed(CURRENCY.DECIMAL_PLACES)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type Sale = {
  id: string;
  saleNumber?: string;
  total: number;
  status: string;
  paymentMethod?: string;
  createdAt: string;
  customer?: { id: string; name?: string; phone?: string };
};

export default function SalesScreen() {
  const router = useRouter();
  const { activeTenant, activeTenantId, hasFeature } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);

  const resolvedType = resolveBusinessType(activeTenant?.businessType);
  const isShop = resolvedType === 'shop';
  const isPharmacy = resolvedType === 'pharmacy';

  const { data: response, isLoading, refetch, isRefetching, error, isError } = useQuery({
    queryKey: ['sales', activeTenantId, statusFilter],
    queryFn: async () => {
      const params: { page?: number; limit?: number; status?: string } = {
        page: 1,
        limit: 15, // Reduced from 20 for faster initial load
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      return saleService.getSales(params);
    },
    enabled: !!activeTenantId && (isShop || isPharmacy) && hasFeature('paymentsExpenses'),
    // Sales data can be stale for 2 minutes (moderate update frequency)
    staleTime: 2 * 60 * 1000,
    // Keep in cache for 1 hour
    gcTime: 60 * 60 * 1000,
    retry: 2, // Retry twice on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Match web app pattern: response?.data?.data || response?.data || []
  const sales = (response?.data?.data || response?.data || []) as Sale[];
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const handleSalePress = useCallback(async (sale: Sale) => {
    setSelectedSale(sale);
    try {
      const res = await saleService.getSaleById(sale.id);
      // Match web app pattern: response?.data?.data || response?.data || response
      const full = res?.data?.data || res?.data || res;
      setDetailSale(full as Sale);
    } catch {
      setDetailSale(sale);
    }
  }, []);

  const handleOpenPOS = useCallback(() => {
    router.push('/(tabs)/scan');
  }, [router]);

  if (!hasFeature('paymentsExpenses')) {
    return <FeatureAccessDenied message="Sales are not enabled for this workspace." />;
  }

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  const renderSaleItem = ({ item }: { item: Sale }) => (
    <Pressable
      onPress={() => handleSalePress(item)}
      style={({ pressed }) => [
        styles.saleCard,
        { backgroundColor: cardBg, borderColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.saleRow}>
        <Text style={[styles.saleNumber, { color: textColor }]}>
          {item.saleNumber || `#${item.id.slice(0, 8)}`}
        </Text>
        <Text style={[styles.saleTotal, { color: colors.tint }]}>
          {formatCurrency(item.total)}
        </Text>
      </View>
      <Text style={[styles.saleCustomer, { color: mutedColor }]} numberOfLines={1}>
        {item.customer?.name ?? 'Walk-in'}
      </Text>
      <View style={styles.saleMeta}>
        <Text style={[styles.saleDate, { color: mutedColor }]}>
          {formatDate(item.createdAt)}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'completed' ? '#dcfce7' : '#fef3c7' }]}>
          <Text style={[styles.statusText, { color: item.status === 'completed' ? '#166534' : '#92400e' }]}>
            {item.status}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  // Sales should only be available for shop/pharmacy businesses
  if (!isShop && !isPharmacy) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.emptyTitle, { color: textColor }]}>Sales</Text>
        <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
          Sales are available for shop and pharmacy businesses only.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Open POS button */}
      {(isShop || isPharmacy) && (
        <Pressable
          onPress={handleOpenPOS}
          style={[styles.posButton, { backgroundColor: colors.tint }]}
        >
          <FontAwesome name="shopping-cart" size={20} color="#fff" />
          <Text style={styles.posButtonText}>Open POS</Text>
        </Pressable>
      )}

      {/* Status filter */}
      <View style={styles.filterRow}>
        {['all', 'completed', 'pending'].map((s) => (
          <Pressable
            key={s}
            onPress={() => setStatusFilter(s)}
            style={[
              styles.filterBtn,
              { borderColor },
              statusFilter === s && { backgroundColor: colors.tint, borderColor: colors.tint },
            ]}
          >
            <Text style={[styles.filterText, { color: statusFilter === s ? '#fff' : textColor }]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: mutedColor }]}>Loading sales...</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <FontAwesome name="exclamation-triangle" size={48} color="#ef4444" />
          <Text style={[styles.emptyTitle, { color: textColor }]}>Failed to load sales</Text>
          <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
            {error?.message?.includes('timeout') 
              ? 'Request timed out. Please check your connection and try again.'
              : 'An error occurred while loading sales. Please try again.'}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id}
          renderItem={renderSaleItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="shopping-cart" size={48} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No sales yet</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                Sales will appear here
              </Text>
            </View>
          }
        />
      )}

      {/* Sale detail modal */}
      <Modal
        visible={!!selectedSale}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedSale(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedSale(null)}>
          <Pressable style={[styles.modalContent, { backgroundColor: cardBg }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                {detailSale?.saleNumber || selectedSale?.saleNumber || 'Sale details'}
              </Text>
              <Pressable onPress={() => setSelectedSale(null)} hitSlop={12}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            {detailSale && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Total</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {formatCurrency(detailSale.total)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Customer</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {detailSale.customer?.name ?? 'Walk-in'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Date</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {formatDate(detailSale.createdAt)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Status</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>{detailSale.status}</Text>
                </View>
                {(detailSale as any).items?.length > 0 && (
                  <>
                    <Text style={[styles.detailSection, { color: textColor }]}>Items</Text>
                    {(detailSale as any).items.map((item: { name: string; quantity: number; total: number }, i: number) => (
                      <View key={i} style={styles.itemRow}>
                        <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                          {item.name} x{item.quantity}
                        </Text>
                        <Text style={[styles.itemTotal, { color: textColor }]}>
                          {formatCurrency(item.total)}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  posButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    padding: 14,
    borderRadius: 12,
  },
  posButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  filterText: { fontSize: 14, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  saleCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  saleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saleNumber: { fontSize: 16, fontWeight: '600' },
  saleTotal: { fontSize: 16, fontWeight: '700' },
  saleCustomer: { fontSize: 14, marginTop: 4 },
  saleMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  saleDate: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBody: { padding: 20 },
  detailRow: { marginBottom: 16 },
  detailLabel: { fontSize: 12, marginBottom: 4 },
  detailValue: { fontSize: 16, fontWeight: '500' },
  detailSection: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemName: { flex: 1, fontSize: 14 },
  itemTotal: { fontSize: 14, fontWeight: '600' },
});
