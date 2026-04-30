import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deliveryService } from '@/services/deliveryService';
import { useAuth } from '@/context/AuthContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { STUDIO_TYPES, DELIVERY_STATUS_LABELS, DELIVERY_STATUS_ORDER } from '@/constants';
import { useDebounce } from '@/hooks/useDebounce';

type QueueRow = {
  entityType: 'job' | 'sale';
  id: string;
  reference?: string;
  title?: string | null;
  customerName?: string | null;
  deliveryStatus?: string | null;
};

export default function DeliveriesScreen() {
  const { activeTenantId, activeTenant, hasFeature } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<'active' | 'done'>('active');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [pickerRow, setPickerRow] = useState<QueueRow | null>(null);

  const debouncedSearch = useDebounce(searchText, 400);

  const businessType = activeTenant?.businessType || '';
  const isStudioLike = STUDIO_TYPES.includes(businessType);

  const activeQuery = useQuery({
    queryKey: ['deliveries-queue', 'active', activeTenantId],
    queryFn: () => deliveryService.getQueue('active'),
    enabled: !!activeTenantId && scope === 'active' && hasFeature('deliveries'),
  });

  const doneQuery = useQuery({
    queryKey: ['deliveries-queue', 'done', activeTenantId],
    queryFn: () => deliveryService.getQueue('done'),
    enabled: !!activeTenantId && scope === 'done' && hasFeature('deliveries'),
  });

  const res = scope === 'done' ? doneQuery.data : activeQuery.data;
  const isLoading = scope === 'done' ? doneQuery.isLoading : activeQuery.isLoading;
  const isRefetching = activeQuery.isRefetching || doneQuery.isRefetching;
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['deliveries-queue'] });
  }, [queryClient]);

  const rows: QueueRow[] = useMemo(() => {
    const raw = res?.data?.rows;
    if (!Array.isArray(raw)) return [];
    return isStudioLike ? raw.filter((r) => r.entityType === 'job') : raw.filter((r) => r.entityType === 'sale');
  }, [res, isStudioLike]);

  const filtered = useMemo(() => {
    let list = rows;
    if (scope === 'active') {
      if (statusFilter === 'not_set') list = list.filter((r) => !r.deliveryStatus);
      else if (statusFilter === 'ready_for_delivery')
        list = list.filter((r) => r.deliveryStatus === 'ready_for_delivery');
      else if (statusFilter === 'out_for_delivery')
        list = list.filter((r) => r.deliveryStatus === 'out_for_delivery');
      else if (statusFilter === 'delivered') list = list.filter((r) => r.deliveryStatus === 'delivered');
      else if (statusFilter === 'returned') list = list.filter((r) => r.deliveryStatus === 'returned');
    } else {
      if (statusFilter === 'delivered') list = list.filter((r) => r.deliveryStatus === 'delivered');
      else if (statusFilter === 'returned') list = list.filter((r) => r.deliveryStatus === 'returned');
    }
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const blob = [r.reference, r.title, r.customerName].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [rows, statusFilter, debouncedSearch, scope]);

  const patchMutation = useMutation({
    mutationFn: (updates: Parameters<typeof deliveryService.patchStatuses>[0]) => deliveryService.patchStatuses(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries-queue'] });
      setPickerRow(null);
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) => {
      Alert.alert('Update failed', e?.response?.data?.message || e?.message || 'Try again');
    },
  });

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  const renderRow = ({ item }: { item: QueueRow }) => {
    const label = item.deliveryStatus ? DELIVERY_STATUS_LABELS[item.deliveryStatus] || item.deliveryStatus : 'Not set';
    return (
      <Pressable
        onPress={() => setPickerRow(item)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: cardBg, borderColor },
          pressed && { opacity: 0.88 },
        ]}
      >
        <View style={styles.rowTop}>
          <Text style={[styles.ref, { color: textColor }]} numberOfLines={1}>
            {item.reference || item.id.slice(0, 8)}
          </Text>
          <FontAwesome name="truck" size={14} color={colors.tint} />
        </View>
        {item.title ? <Text style={[styles.title, { color: mutedColor }]} numberOfLines={2}>{item.title}</Text> : null}
        {item.customerName ? (
          <Text style={[styles.cust, { color: mutedColor }]} numberOfLines={1}>
            {item.customerName}
          </Text>
        ) : null}
        <View style={[styles.statusPill, { borderColor: colors.tint }]}>
          <Text style={[styles.statusPillText, { color: colors.tint }]}>{label}</Text>
        </View>
      </Pressable>
    );
  };

  if (!hasFeature('deliveries')) {
    return <FeatureAccessDenied message="Deliveries are not enabled for this workspace." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.scopeRow, { borderBottomColor: borderColor }]}>
        {(['active', 'done'] as const).map((s) => {
          const on = scope === s;
          return (
            <Pressable
              key={s}
              onPress={() => {
                setScope(s);
                setStatusFilter('all');
              }}
              style={[
                styles.scopeBtn,
                { borderColor: on ? colors.tint : borderColor, backgroundColor: on ? `${colors.tint}22` : cardBg },
              ]}
            >
              <Text style={{ color: on ? colors.tint : textColor, fontWeight: '700', textTransform: 'capitalize' }}>
                {s}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.searchWrap, { backgroundColor: resolvedTheme === 'dark' ? '#18181b' : '#f3f4f6', borderColor }]}>
        <FontAwesome name="search" size={16} color={mutedColor} style={{ marginRight: 8 }} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder={isStudioLike ? 'Search jobs…' : 'Search sales…'}
          placeholderTextColor={mutedColor}
          style={[styles.searchInput, { color: textColor }]}
        />
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {scope === 'active' ? (
            <>
              {['all', 'not_set', 'ready_for_delivery', 'out_for_delivery', 'delivered', 'returned'].map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setStatusFilter(f)}
                  style={[
                    styles.chip,
                    { borderColor: statusFilter === f ? colors.tint : borderColor, backgroundColor: statusFilter === f ? `${colors.tint}22` : cardBg },
                  ]}
                >
                  <Text style={{ color: statusFilter === f ? colors.tint : textColor, fontWeight: '600', fontSize: 12 }}>
                    {f === 'all' ? 'All' : DELIVERY_STATUS_LABELS[f] || f.replace(/_/g, ' ')}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              {['all', 'delivered', 'returned'].map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setStatusFilter(f)}
                  style={[
                    styles.chip,
                    { borderColor: statusFilter === f ? colors.tint : borderColor, backgroundColor: statusFilter === f ? `${colors.tint}22` : cardBg },
                  ]}
                >
                  <Text style={{ color: statusFilter === f ? colors.tint : textColor, fontWeight: '600', fontSize: 12 }}>
                    {f === 'all' ? 'All' : DELIVERY_STATUS_LABELS[f]}
                  </Text>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      </View>

      {isLoading && !res ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.tint} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.entityType}:${item.id}`}
          renderItem={renderRow}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={<Text style={{ color: mutedColor, textAlign: 'center', marginTop: 32 }}>Nothing in this queue.</Text>}
        />
      )}

      <Modal visible={!!pickerRow} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerRow(null)}>
          <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Delivery status</Text>
            <Pressable
              onPress={() => {
                if (!pickerRow) return;
                patchMutation.mutate([{ entityType: pickerRow.entityType, id: pickerRow.id, deliveryStatus: null }]);
              }}
              style={[styles.pickRow, { borderBottomColor: borderColor }]}
            >
              <Text style={{ color: textColor }}>Not set</Text>
            </Pressable>
            {DELIVERY_STATUS_ORDER.map((key) => (
              <Pressable
                key={key}
                onPress={() => {
                  if (!pickerRow) return;
                  patchMutation.mutate([{ entityType: pickerRow.entityType, id: pickerRow.id, deliveryStatus: key }]);
                }}
                style={[styles.pickRow, { borderBottomColor: borderColor }]}
              >
                <Text style={{ color: textColor }}>{DELIVERY_STATUS_LABELS[key]}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setPickerRow(null)} style={{ padding: 14, alignItems: 'center' }}>
              <Text style={{ color: mutedColor, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scopeRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  scopeBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  searchWrap: {
    marginHorizontal: 12,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  filterRow: { paddingHorizontal: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontSize: 16, fontWeight: '700', flex: 1 },
  title: { marginTop: 6, fontSize: 14 },
  cust: { marginTop: 4, fontSize: 14 },
  statusPill: { alignSelf: 'flex-start', marginTop: 10, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  modalTitle: { fontSize: 18, fontWeight: '700', padding: 14 },
  pickRow: { paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1 },
});
