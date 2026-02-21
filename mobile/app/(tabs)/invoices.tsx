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

import { invoiceService } from '@/services/invoiceService';
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
    paid: '#10b981',
    overdue: '#ef4444',
    cancelled: '#6b7280',
  };
  return statusColors[status] || '#6b7280';
}

type Invoice = {
  id: string;
  invoiceNumber?: string;
  total?: number;
  totalAmount?: number;
  status: string;
  dueDate?: string;
  createdAt: string;
  customer?: { id: string; name?: string };
  paidAmount?: number;
  amountPaid?: number;
};

export default function InvoicesScreen() {
  const { activeTenantId } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);

  const { data: response, isLoading, refetch, isRefetching, error, isError } = useQuery({
    queryKey: ['invoices', activeTenantId, statusFilter],
    queryFn: async () => {
      const params: { page?: number; limit?: number; status?: string } = {
        page: 1,
        limit: 20,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      return invoiceService.getInvoices(params);
    },
    enabled: !!activeTenantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const invoices = (response?.data || []) as Invoice[];
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const handleInvoicePress = useCallback(async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    try {
      const res = await invoiceService.getInvoiceById(invoice.id);
      const full = res?.data || res;
      setDetailInvoice(full as Invoice);
    } catch {
      setDetailInvoice(invoice);
    }
  }, []);

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  const renderInvoiceItem = ({ item }: { item: Invoice }) => {
    const statusColor = getStatusColor(item.status);
    const isOverdue = item.status === 'overdue' || (item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'paid');

    return (
      <Pressable
        onPress={() => handleInvoicePress(item)}
        style={({ pressed }) => [
          styles.invoiceCard,
          { backgroundColor: cardBg, borderColor },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.invoiceRow}>
          <View style={styles.invoiceInfo}>
            <Text style={[styles.invoiceNumber, { color: textColor }]}>
              {item.invoiceNumber || `#${item.id.slice(0, 8)}`}
            </Text>
            <Text style={[styles.invoiceCustomer, { color: mutedColor }]} numberOfLines={1}>
              {item.customer?.name ?? '—'}
            </Text>
          </View>
          <View style={styles.invoiceAmount}>
            <Text style={[styles.invoiceTotal, { color: colors.tint }]}>
              {formatCurrency(item.totalAmount ?? item.total)}
            </Text>
            {(item.amountPaid ?? item.paidAmount) !== undefined && (item.amountPaid ?? item.paidAmount)! > 0 && (
              <Text style={[styles.invoicePaid, { color: mutedColor }]}>
                Paid: {formatCurrency(item.amountPaid ?? item.paidAmount)}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.invoiceMeta}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
          {item.dueDate && (
            <Text style={[styles.dueDate, { color: isOverdue ? '#ef4444' : mutedColor }]}>
              Due {formatDate(item.dueDate)}
            </Text>
          )}
          <Text style={[styles.invoiceDate, { color: mutedColor }]}>
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
        {['all', 'draft', 'sent', 'paid', 'overdue'].map((s) => (
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
          <Text style={[styles.loadingText, { color: mutedColor }]}>Loading invoices...</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <FontAwesome name="exclamation-triangle" size={48} color="#ef4444" />
          <Text style={[styles.emptyTitle, { color: textColor }]}>Failed to load invoices</Text>
          <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
            {error?.message?.includes('timeout')
              ? 'Request timed out. Please check your connection and try again.'
              : 'An error occurred while loading invoices. Please try again.'}
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
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderInvoiceItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="file-text" size={48} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No invoices yet</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                Invoices will appear here
              </Text>
            </View>
          }
        />
      )}

      {/* Invoice detail modal */}
      <Modal
        visible={!!selectedInvoice}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedInvoice(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedInvoice(null)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                {detailInvoice?.invoiceNumber || selectedInvoice?.invoiceNumber || 'Invoice details'}
              </Text>
              <Pressable onPress={() => setSelectedInvoice(null)} hitSlop={12}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            {detailInvoice && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Total</Text>
                  <Text style={[styles.detailValue, { color: colors.tint, fontSize: 18, fontWeight: '700' }]}>
                    {formatCurrency(detailInvoice.totalAmount ?? detailInvoice.total)}
                  </Text>
                </View>
                {((detailInvoice.amountPaid ?? detailInvoice.paidAmount) ?? 0) > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Paid</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {formatCurrency(detailInvoice.amountPaid ?? detailInvoice.paidAmount)}
                    </Text>
                  </View>
                )}
                {((detailInvoice.totalAmount ?? detailInvoice.total) ?? 0) > ((detailInvoice.amountPaid ?? detailInvoice.paidAmount) ?? 0) && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Balance</Text>
                    <Text style={[styles.detailValue, { color: '#ef4444', fontWeight: '600' }]}>
                      {formatCurrency((detailInvoice.totalAmount ?? detailInvoice.total ?? 0) - (detailInvoice.amountPaid ?? detailInvoice.paidAmount ?? 0))}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Customer</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {detailInvoice.customer?.name ?? '—'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(detailInvoice.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(detailInvoice.status) }]}>
                      {detailInvoice.status.charAt(0).toUpperCase() + detailInvoice.status.slice(1)}
                    </Text>
                  </View>
                </View>
                {detailInvoice.dueDate && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Due Date</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {formatDate(detailInvoice.dueDate)}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Created</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {formatDate(detailInvoice.createdAt)}
                  </Text>
                </View>
                {(detailInvoice as any).items?.length > 0 && (
                  <>
                    <Text style={[styles.detailSection, { color: textColor }]}>Items</Text>
                    {(detailInvoice as any).items.map(
                      (item: { description: string; quantity: number; unitPrice: number }, i: number) => (
                        <View key={i} style={styles.itemRow}>
                          <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                            {item.description} x{item.quantity}
                          </Text>
                          <Text style={[styles.itemTotal, { color: textColor }]}>
                            {formatCurrency(item.unitPrice * item.quantity)}
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
  invoiceCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceInfo: { flex: 1, marginRight: 12 },
  invoiceNumber: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  invoiceCustomer: { fontSize: 14 },
  invoiceAmount: { alignItems: 'flex-end' },
  invoiceTotal: { fontSize: 16, fontWeight: '700' },
  invoicePaid: { fontSize: 12, marginTop: 4 },
  invoiceMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },
  dueDate: { fontSize: 12 },
  invoiceDate: { fontSize: 12 },
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
