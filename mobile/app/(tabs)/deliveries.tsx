import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppIcon } from '@/components/AppIcon';
import { ListEmptyState } from '@/components/ListEmptyState';
import { SEARCH_PLACEHOLDERS } from '@/constants/searchPlaceholders';
import { useSmartSearch } from '@/context/SmartSearchContext';
import { useRegisterPageSearch } from '@/hooks/useRegisterPageSearch';
import { flatListStyleForEmpty, listContentStyleWhenEmpty, showListFilters } from '@/utils/listEmptyLayout';
import { deliveryService } from '@/services/deliveryService';
import { useAuth } from '@/context/AuthContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { FilterChipRow } from '@/components/FilterChip';
import { ListLoadingState, ListErrorState } from '@/components/ListScreenStates';
import { getApiErrorMessage } from '@/utils/parseApiListResponse';
import { resolveBusinessType } from '@/constants';
import { useDebounce } from '@/hooks/useDebounce';
import {
  DELIVERY_ACTIVE_FILTERS,
  DELIVERY_STATUS_ORDER,
  getDeliveryQueueFilterLabel,
  getDeliveryStatusColors,
  getDeliveryStatusDisplayLabel,
} from '@/utils/deliveryStatus';

type QueueRow = {
  entityType: 'job' | 'sale';
  id: string;
  reference?: string;
  title?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  addressSummary?: string | null;
  deliveryStatus?: string | null;
  completedAt?: string;
  total?: number | null;
};

export default function DeliveriesScreen() {
  const { activeTenantId, activeTenant, hasFeature } = useAuth();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor, resolvedTheme } = useScreenColors();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pickerRow, setPickerRow] = useState<QueueRow | null>(null);

  const isStudioLike = resolveBusinessType(activeTenant?.businessType) === 'studio';
  const isTerminalFilter = statusFilter === 'delivered' || statusFilter === 'returned';

  const { searchValue } = useSmartSearch();
  useRegisterPageSearch({
    scope: 'deliveries',
    placeholder: isStudioLike ? SEARCH_PLACEHOLDERS.JOBS : SEARCH_PLACEHOLDERS.SALES,
  });
  const debouncedSearch = useDebounce(searchValue, 400);

  const activeQuery = useQuery({
    queryKey: ['deliveries-queue', 'active', activeTenantId],
    queryFn: () => deliveryService.getQueue('active'),
    enabled: !!activeTenantId && !isTerminalFilter && hasFeature('deliveries'),
  });

  const doneQuery = useQuery({
    queryKey: ['deliveries-queue', 'done', activeTenantId],
    queryFn: () => deliveryService.getQueue('done'),
    enabled: !!activeTenantId && isTerminalFilter && hasFeature('deliveries'),
  });

  const queueRes = isTerminalFilter ? doneQuery.data : activeQuery.data;
  const isLoading = isTerminalFilter ? doneQuery.isLoading : activeQuery.isLoading;
  const isError = isTerminalFilter ? doneQuery.isError : activeQuery.isError;
  const queryError = isTerminalFilter ? doneQuery.error : activeQuery.error;
  const isRefetching = activeQuery.isRefetching || doneQuery.isRefetching;
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['deliveries-queue'] });
  }, [queryClient]);

  const rows: QueueRow[] = useMemo(() => {
    const raw = queueRes?.data?.rows;
    if (!Array.isArray(raw)) return [];
    return isStudioLike ? raw.filter((r) => r.entityType === 'job') : raw.filter((r) => r.entityType === 'sale');
  }, [queueRes, isStudioLike]);

  const statusFilteredRows = useMemo(() => {
    if (isTerminalFilter) {
      if (statusFilter === 'delivered') {
        return rows.filter((r) => r.deliveryStatus === 'delivered');
      }
      if (statusFilter === 'returned') {
        return rows.filter((r) => r.deliveryStatus === 'returned');
      }
      return rows;
    }
    if (statusFilter === 'all') return rows;
    if (statusFilter === 'not_set') return rows.filter((r) => !r.deliveryStatus);
    if (statusFilter === 'ready_for_delivery') {
      return rows.filter((r) => r.deliveryStatus === 'ready_for_delivery');
    }
    if (statusFilter === 'out_for_delivery') {
      return rows.filter((r) => r.deliveryStatus === 'out_for_delivery');
    }
    return rows;
  }, [rows, statusFilter, isTerminalFilter]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return statusFilteredRows;
    return statusFilteredRows.filter((r) => {
      const blob = [r.reference, r.title, r.customerName, r.customerPhone, r.addressSummary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [statusFilteredRows, debouncedSearch]);

  const hasActiveFilter = statusFilter !== 'all' || !!debouncedSearch.trim();
  const filtersExcludeAll = rows.length > 0 && statusFilteredRows.length === 0 && statusFilter !== 'all';
  const searchFilteredOut =
    statusFilteredRows.length > 0 && filtered.length === 0 && !!debouncedSearch.trim();

  const patchMutation = useMutation({
    mutationFn: (updates: Parameters<typeof deliveryService.patchStatuses>[0]) =>
      deliveryService.patchStatuses(updates),
    onSuccess: (response) => {
      const failed = response?.data?.results?.find((result: { ok?: boolean }) => !result.ok);
      if (failed) {
        Alert.alert('Update failed', failed.message || 'Could not update delivery status');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['deliveries-queue'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'infinite'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setPickerRow(null);
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) => {
      Alert.alert('Update failed', e?.response?.data?.message || e?.message || 'Try again');
    },
  });

  const deliveryFilterOptions = useMemo(
    () =>
      DELIVERY_ACTIVE_FILTERS.map((f) => ({
        value: f,
        label: getDeliveryQueueFilterLabel('active', f),
      })),
    []
  );

  const loadErrorMessage = useMemo(
    () => getApiErrorMessage(queryError, 'Could not load deliveries. Pull to refresh.'),
    [queryError]
  );

  const renderRow = ({ item }: { item: QueueRow }) => {
    const label = getDeliveryStatusDisplayLabel(item.deliveryStatus);
    const statusColors = getDeliveryStatusColors(item.deliveryStatus);
    const unset = !item.deliveryStatus;
    const pillText = unset && resolvedTheme === 'dark' ? mutedColor : statusColors.text;
    const pillBorder = unset && resolvedTheme === 'dark' ? borderColor : statusColors.border;

    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.rowTop}>
          <View style={[styles.typeBadge, { borderColor }]}>
            <Text style={[styles.typeBadgeText, { color: mutedColor }]}>
              {item.entityType === 'job' ? 'Job' : 'Sale'}
            </Text>
          </View>
          <Text style={[styles.ref, { color: textColor }]} numberOfLines={1}>
            {item.reference || item.id.slice(0, 8)}
          </Text>
          <AppIcon name="truck" size={14} color={colors.tint} />
        </View>
        {item.title ? (
          <Text style={[styles.title, { color: mutedColor }]} numberOfLines={2}>
            {item.title}
          </Text>
        ) : null}
        {item.customerName ? (
          <Text style={[styles.cust, { color: textColor }]} numberOfLines={1}>
            {item.customerName}
          </Text>
        ) : null}
        {item.customerPhone ? (
          <Text style={[styles.meta, { color: mutedColor }]} numberOfLines={1}>
            {item.customerPhone}
          </Text>
        ) : null}
        {item.addressSummary ? (
          <Text style={[styles.meta, { color: mutedColor }]} numberOfLines={2}>
            {item.addressSummary}
          </Text>
        ) : null}
        <Pressable
          onPress={() => setPickerRow(item)}
          style={({ pressed }) => [
            styles.statusSelect,
            {
              borderColor: pillBorder,
              backgroundColor: unset ? cardBg : statusColors.bg,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <Text style={[styles.statusSelectText, { color: pillText }]} numberOfLines={1}>
            {label}
          </Text>
          <AppIcon name="chevron-down" size={16} color={pillText} />
        </Pressable>
      </View>
    );
  };

  const emptyTitle = searchFilteredOut
    ? 'No matches'
    : filtersExcludeAll
      ? 'No matches for filters'
      : 'Nothing here yet';

  const emptySubtitle = searchFilteredOut
    ? 'Try another term in the search box at the top of the page.'
    : filtersExcludeAll
      ? 'Change the delivery status filter above.'
      : isStudioLike
        ? 'When jobs are completed, they appear here so you can set delivery status.'
        : 'When sales are completed, they appear here so you can set delivery status.';

  if (!hasFeature('deliveries')) {
    return <FeatureAccessDenied message="Deliveries are not enabled for this workspace." />;
  }

  return (
    <ScreenShell style={styles.container}>
      {showListFilters(isLoading, isError, rows.length, hasActiveFilter) && (
        <FilterChipRow
          options={deliveryFilterOptions}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      )}

      {isLoading && !queueRes ? (
        <ListLoadingState message="Loading deliveries..." />
      ) : isError ? (
        <ListErrorState title="Failed to load deliveries" message={loadErrorMessage} onRetry={refetch} />
      ) : (
        <FlatList
          style={flatListStyleForEmpty}
          data={filtered}
          keyExtractor={(item) => `${item.entityType}:${item.id}`}
          renderItem={renderRow}
          contentContainerStyle={listContentStyleWhenEmpty(
            { padding: 12, paddingBottom: 32 },
            filtered.length === 0
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.tint} />}
          ListEmptyComponent={
            <ListEmptyState
              imageKey="DELIVERIES"
              title={emptyTitle}
              subtitle={emptySubtitle}
              titleColor={textColor}
              subtitleColor={mutedColor}
            />
          }
        />
      )}

      <Modal visible={!!pickerRow} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerRow(null)}>
          <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Delivery status</Text>
            <Pressable
              onPress={() => {
                if (!pickerRow) return;
                patchMutation.mutate([
                  { entityType: pickerRow.entityType, id: pickerRow.id, deliveryStatus: null },
                ]);
              }}
              style={[styles.pickRow, { borderBottomColor: borderColor }]}
            >
              <Text style={{ color: textColor, flex: 1 }}>Not set yet</Text>
              {!pickerRow?.deliveryStatus ? (
                <AppIcon name="check" size={16} color={colors.tint} />
              ) : null}
            </Pressable>
            {DELIVERY_STATUS_ORDER.map((key) => {
              const selected = pickerRow?.deliveryStatus === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    if (!pickerRow) return;
                    patchMutation.mutate([
                      { entityType: pickerRow.entityType, id: pickerRow.id, deliveryStatus: key },
                    ]);
                  }}
                  style={[styles.pickRow, { borderBottomColor: borderColor }]}
                >
                  <Text style={{ color: textColor, flex: 1 }}>
                    {getDeliveryStatusDisplayLabel(key)}
                  </Text>
                  {selected ? <AppIcon name="check" size={16} color={colors.tint} /> : null}
                </Pressable>
              );
            })}
            <Pressable onPress={() => setPickerRow(null)} style={{ padding: 14, alignItems: 'center' }}>
              <Text style={{ color: mutedColor, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { paddingHorizontal: 12, paddingTop: 8 },
  filterLabel: { fontSize: 12, fontWeight: '600' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  ref: { fontSize: 16, fontWeight: '700', flex: 1 },
  title: { marginTop: 6, fontSize: 14 },
  cust: { marginTop: 6, fontSize: 14, fontWeight: '500' },
  meta: { marginTop: 4, fontSize: 12 },
  statusSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  statusSelectText: { fontSize: 14, fontWeight: '600', flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  modalTitle: { fontSize: 18, fontWeight: '700', padding: 14 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
});
