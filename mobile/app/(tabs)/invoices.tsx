import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { ListEmptyState } from '@/components/ListEmptyState';
import { SEARCH_PLACEHOLDERS } from '@/constants/searchPlaceholders';
import { useSmartSearch } from '@/context/SmartSearchContext';
import { useRegisterPageSearch } from '@/hooks/useRegisterPageSearch';
import { useDebounce } from '@/hooks/useDebounce';
import { flatListStyleForEmpty, listContentStyleWhenEmpty, showListFilters } from '@/utils/listEmptyLayout';
import { getApiErrorMessage, parseApiListResponse } from '@/utils/parseApiListResponse';
import { formatStatusLabel } from '@/utils/formatLabels';
import { invoiceService } from '@/services/invoiceService';
import { useAuth } from '@/context/AuthContext';
import { useWorkspaceScope } from '@/hooks/useWorkspaceScope';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { FilterChipRow } from '@/components/FilterChip';
import { ListLoadingState, ListErrorState } from '@/components/ListScreenStates';
import { CURRENCY } from '@/constants';
import { formatCurrency } from '@/utils/formatCurrency';

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
  const router = useRouter();
  const { activeTenantId, hasFeature } = useAuth();
  const { activeShopId, activeStudioLocationId, scopeReady } = useWorkspaceScope();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor, inputBg } = useScreenColors();

  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { searchValue } = useSmartSearch();
  useRegisterPageSearch({ scope: 'invoices', placeholder: SEARCH_PLACEHOLDERS.INVOICES });
  const debouncedSearch = useDebounce(searchValue, 400);

  const { data: response, isLoading, refetch, isRefetching, error, isError } = useQuery({
    queryKey: ['invoices', activeTenantId, activeShopId, activeStudioLocationId, statusFilter, debouncedSearch],
    queryFn: async () => {
      const params: { page?: number; limit?: number; status?: string; search?: string } = {
        page: 1,
        limit: 20,
        search: debouncedSearch || undefined,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      return invoiceService.getInvoices(params);
    },
    enabled: !!activeTenantId && hasFeature('invoices') && scopeReady,
    staleTime: 2 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const invoices = useMemo(() => parseApiListResponse<Invoice>(response), [response]);
  const loadErrorMessage = useMemo(
    () => getApiErrorMessage(error, 'An error occurred while loading invoices. Please try again.'),
    [error]
  );

  const isEmpty = !isLoading && !isError && invoices.length === 0;
  const hasActiveFilter = statusFilter !== 'all' || !!debouncedSearch.trim();
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const filterOptions = useMemo(
    () =>
      (['all', 'draft', 'sent', 'paid', 'overdue'] as const).map((s) => ({
        value: s,
        label: s === 'all' ? 'All' : formatStatusLabel(s),
      })),
    []
  );

  const emptyMessage = useMemo(() => {
    if (statusFilter === 'all') {
      return {
        title: 'No invoices yet',
        subtitle: 'Invoices from sales and jobs will appear here',
      };
    }
    const label = statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);
    return {
      title: `No ${label.toLowerCase()} invoices`,
      subtitle: 'Try another filter or create a new invoice',
    };
  }, [statusFilter]);

  const handleInvoicePress = useCallback(
    (invoice: Invoice) => {
      router.push(`/invoice/${invoice.id}` as never);
    },
    [router]
  );

  if (!hasFeature('invoices')) {
    return <FeatureAccessDenied message="Invoices are not enabled for this workspace." />;
  }


  const renderInvoiceItem = ({ item }: { item: Invoice }) => {
    const statusKey = item.status || 'draft';
    const statusColor = getStatusColor(statusKey);
    const isOverdue =
      statusKey === 'overdue' ||
      (item.dueDate && new Date(item.dueDate) < new Date() && statusKey !== 'paid');

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
              {formatStatusLabel(statusKey)}
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
    <ScreenShell style={styles.container}>
      {/* Status filter */}
      {showListFilters(isLoading, isError, invoices.length, hasActiveFilter) && (
        <FilterChipRow options={filterOptions} value={statusFilter} onChange={setStatusFilter} />
      )}

      {isLoading && !response ? (
        <ListLoadingState message="Loading invoices..." />
      ) : isError ? (
        <ListErrorState title="Failed to load invoices" message={loadErrorMessage} onRetry={refetch} />
      ) : (
        <FlatList
          style={flatListStyleForEmpty}
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderInvoiceItem}
          contentContainerStyle={listContentStyleWhenEmpty(styles.listContent, isEmpty)}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          ListEmptyComponent={
            <ListEmptyState
              imageKey="INVOICES"
              title={emptyMessage.title}
              subtitle={emptyMessage.subtitle}
              titleColor={textColor}
              subtitleColor={mutedColor}
            />
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
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },
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
  modalActions: {
    padding: 16,
    borderTopWidth: 1,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  actionBtnOutline: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnPrimary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  actionBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  paymentBlock: { gap: 10 },
  inputLabel: { fontSize: 12 },
  paymentInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
