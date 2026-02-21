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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery } from '@tanstack/react-query';

import { quoteService } from '@/services/quoteService';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { CURRENCY } from '@/constants';
import Colors from '@/constants/Colors';

function formatCurrency(value: number | string | null | undefined): string {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value ?? 0)) || 0;
  return `${CURRENCY.SYMBOL} ${numValue.toFixed(CURRENCY.DECIMAL_PLACES)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    draft: '#6b7280',
    sent: '#3b82f6',
    accepted: '#10b981',
    declined: '#ef4444',
    expired: '#6b7280',
  };
  return statusColors[status] || '#6b7280';
}

type Quote = {
  id: string;
  quoteNumber?: string;
  title: string;
  status: string;
  totalAmount: number;
  validUntil?: string;
  createdAt: string;
  customer?: { id: string; name?: string };
};

export default function QuotesScreen() {
  const { activeTenant, activeTenantId } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [detailQuote, setDetailQuote] = useState<Quote | null>(null);

  const businessType = activeTenant?.businessType ?? 'printing_press';
  const isPrintingPress = businessType === 'printing_press';

  const { data: response, isLoading, refetch, isRefetching, error, isError } = useQuery({
    queryKey: ['quotes', activeTenantId, statusFilter],
    queryFn: async () => {
      const params: { page?: number; limit?: number; status?: string } = {
        page: 1,
        limit: 20,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      return quoteService.getQuotes(params);
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!activeTenantId && isPrintingPress,
  });

  const quotes = (response?.data || []) as Quote[];
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const handleQuotePress = useCallback(async (quote: Quote) => {
    setSelectedQuote(quote);
    try {
      const res = await quoteService.getQuoteById(quote.id);
      const full = res?.data || res;
      setDetailQuote(full as Quote);
    } catch {
      setDetailQuote(quote);
    }
  }, []);

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  if (!isPrintingPress) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.emptyTitle, { color: textColor }]}>Quotes</Text>
        <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
          Quotes are available for printing press businesses.
        </Text>
      </View>
    );
  }

  const renderQuoteItem = ({ item }: { item: Quote }) => {
    const statusColor = getStatusColor(item.status);
    const isExpired = item.validUntil && new Date(item.validUntil) < new Date() && item.status !== 'accepted' && item.status !== 'declined';

    return (
      <Pressable
        onPress={() => handleQuotePress(item)}
        style={({ pressed }) => [
          styles.quoteCard,
          { backgroundColor: cardBg, borderColor },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.quoteRow}>
          <View style={styles.quoteInfo}>
            <Text style={[styles.quoteNumber, { color: textColor }]}>
              {item.quoteNumber || `#${item.id.slice(0, 8)}`}
            </Text>
            <Text style={[styles.quoteTitle, { color: textColor }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.quoteCustomer, { color: mutedColor }]} numberOfLines={1}>
              {item.customer?.name ?? '—'}
            </Text>
          </View>
          <Text style={[styles.quoteTotal, { color: colors.tint }]}>
            {formatCurrency(item.totalAmount)}
          </Text>
        </View>
        <View style={styles.quoteMeta}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
          {item.validUntil && (
            <Text style={[styles.validUntil, { color: isExpired ? '#ef4444' : mutedColor }]}>
              Valid until {formatDate(item.validUntil)}
            </Text>
          )}
          <Text style={[styles.quoteDate, { color: mutedColor }]}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Status filter */}
      <View style={styles.filterRow}>
        {['all', 'draft', 'sent', 'accepted', 'declined'].map((s) => (
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
          <Text style={[styles.loadingText, { color: mutedColor }]}>Loading quotes...</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <FontAwesome name="exclamation-triangle" size={48} color="#ef4444" />
          <Text style={[styles.emptyTitle, { color: textColor }]}>Failed to load quotes</Text>
          <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
            {error?.message?.includes('timeout')
              ? 'Request timed out. Please check your connection and try again.'
              : 'An error occurred while loading quotes. Please try again.'}
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
          data={quotes}
          keyExtractor={(item) => item.id}
          renderItem={renderQuoteItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="file-text-o" size={48} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No quotes yet</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                Quotes will appear here
              </Text>
            </View>
          }
        />
      )}

      {/* Quote detail modal */}
      <Modal
        visible={!!selectedQuote}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedQuote(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedQuote(null)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                {detailQuote?.quoteNumber || selectedQuote?.quoteNumber || 'Quote details'}
              </Text>
              <Pressable onPress={() => setSelectedQuote(null)} hitSlop={12}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            {detailQuote && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Title</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>{detailQuote.title}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Total</Text>
                  <Text style={[styles.detailValue, { color: colors.tint, fontSize: 18, fontWeight: '700' }]}>
                    {formatCurrency(detailQuote.totalAmount)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Customer</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {detailQuote.customer?.name ?? '—'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(detailQuote.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(detailQuote.status) }]}>
                      {detailQuote.status.charAt(0).toUpperCase() + detailQuote.status.slice(1)}
                    </Text>
                  </View>
                </View>
                {detailQuote.validUntil && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Valid Until</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {formatDate(detailQuote.validUntil)}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Created</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {formatDate(detailQuote.createdAt)}
                  </Text>
                </View>
                {(detailQuote as any).items?.length > 0 && (
                  <>
                    <Text style={[styles.detailSection, { color: textColor }]}>Items</Text>
                    {(detailQuote as any).items.map(
                      (item: { description: string; quantity: number; unitPrice: number; total: number }, i: number) => (
                        <View key={i} style={styles.itemRow}>
                          <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                            {item.description} x{item.quantity}
                          </Text>
                          <Text style={[styles.itemTotal, { color: textColor }]}>
                            {formatCurrency(item.total || item.unitPrice * item.quantity)}
                          </Text>
                        </View>
                      )
                    )}
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
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  filterText: { fontSize: 14, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  quoteCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  quoteInfo: { flex: 1, marginRight: 12 },
  quoteNumber: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  quoteTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  quoteCustomer: { fontSize: 14 },
  quoteTotal: { fontSize: 16, fontWeight: '700' },
  quoteMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },
  validUntil: { fontSize: 12 },
  quoteDate: { fontSize: 12 },
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
