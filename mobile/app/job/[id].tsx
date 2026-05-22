import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { jobService } from '@/services/jobService';
import { DetailCard, DetailLoading, DetailNotFound, DetailRow } from '@/components/EntityDetailLayout';
import { ScreenShell } from '@/components/ScreenShell';
import { useScreenColors } from '@/hooks/useScreenColors';
import { CURRENCY } from '@/constants';
import { formatCurrency } from '@/utils/formatCurrency';
import { parseApiEntity } from '@/utils/parseApiListResponse';
import { refreshAfterJobChange } from '@/utils/queryInvalidation';
import { DeliveryStatusPicker } from '@/components/DeliveryStatusPicker';

type TabKey = 'details' | 'services' | 'attachments' | 'activities';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeStatus(status?: string): string {
  return String(status || 'new').trim().toLowerCase();
}

function prettyStatus(status?: string): string {
  return normalizeStatus(status)
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function JobDetailsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor } = useScreenColors();
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [actionsOpen, setActionsOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobService.getJobById(String(id)),
    enabled: !!id,
    staleTime: 60 * 1000,
  });

  const job = useMemo(() => parseApiEntity<any>(data), [data]);

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => jobService.updateJob(String(id), { status }),
    onSuccess: async () => {
      await refreshAfterJobChange(queryClient);
      setActionsOpen(false);
    },
    onError: (err: any) => {
      Alert.alert('Update failed', err?.message || 'Could not update job');
    },
  });

  const updateDeliveryStatusMutation = useMutation({
    mutationFn: (deliveryStatus: string | null) =>
      jobService.updateDeliveryStatus(String(id), deliveryStatus),
    onSuccess: async () => {
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['deliveries-queue'] });
      await refreshAfterJobChange(queryClient);
    },
    onError: (err: any) => {
      Alert.alert(
        'Update failed',
        err?.response?.data?.message || err?.message || 'Could not update delivery status'
      );
    },
  });

  const detailRows = useMemo(
    () => [
      { label: 'Customer', value: job?.customer?.name || '—' },
      { label: 'Status', value: prettyStatus(job?.status) },
      { label: 'Priority', value: job?.priority ? prettyStatus(job.priority) : '—' },
      { label: 'Due Date', value: formatDate(job?.dueDate) },
      { label: 'Created', value: formatDate(job?.createdAt) },
      { label: 'Total', value: formatCurrency(job?.total ?? job?.finalPrice ?? 0) },
    ],
    [job]
  );

  const services = Array.isArray(job?.items) ? job.items : [];
  const attachments = Array.isArray(job?.attachments) ? job.attachments : [];
  const activities = Array.isArray(job?.statusHistory) ? job.statusHistory : [];

  if (isLoading) return <DetailLoading title="Job details" />;
  if (!job) return <DetailNotFound title="Job details" entityLabel="Job" />;

  return (
    <ScreenShell style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: job?.jobNumber || 'Job details',
          headerRight: () => (
            <Pressable onPress={() => setActionsOpen(true)} style={styles.headerActionBtn}>
              <AppIcon name="ellipsis-v" size={18} color={colors.tint} />
            </Pressable>
          ),
        }}
      />

      <>
          <View style={[styles.tabRow, { borderBottomColor: borderColor }]}>
            {(['details', 'services', 'attachments', 'activities'] as TabKey[]).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tabBtn, activeTab === tab && { borderBottomColor: colors.tint }]}
              >
                <Text style={[styles.tabText, { color: activeTab === tab ? colors.tint : mutedColor }]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <DetailCard>
              {/* Keep title as block, per request */}
              <Text style={[styles.sectionTitle, { color: textColor }]}>Title</Text>
              <Text style={[styles.titleValue, { color: textColor }]}>{job.title || '—'}</Text>

              {activeTab === 'details' && (
                <View style={styles.detailList}>
                  {detailRows.map((row) => (
                    <DetailRow key={row.label} label={row.label} value={row.value} />
                  ))}
                  <DetailRow label="Delivery status">
                    <DeliveryStatusPicker
                      value={job?.deliveryStatus}
                      onChange={(nextStatus) => updateDeliveryStatusMutation.mutate(nextStatus)}
                      cardBg={cardBg}
                      borderColor={borderColor}
                      textColor={textColor}
                      mutedColor={mutedColor}
                      tintColor={colors.tint}
                      loading={updateDeliveryStatusMutation.isPending}
                      disabled={normalizeStatus(job?.status) !== 'completed'}
                    />
                  </DetailRow>
                </View>
              )}

              {activeTab === 'services' && (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>Items</Text>
                  {services.length === 0 ? (
                    <Text style={[styles.emptyText, { color: mutedColor }]}>No service items</Text>
                  ) : (
                    services.map((item: any, i: number) => {
                      const qty = item?.quantity || 1;
                      const lineTotal =
                        (item?.unitPrice || item?.price || 0) * qty;
                      return (
                        <DetailRow
                          key={`${item?.id || i}`}
                          label={`${item?.description || item?.name || 'Item'} × ${qty}`}
                          value={formatCurrency(lineTotal)}
                        />
                      );
                    })
                  )}
                </View>
              )}

              {activeTab === 'attachments' && (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>Attachments</Text>
                  {attachments.length === 0 ? (
                    <Text style={[styles.emptyText, { color: mutedColor }]}>No attachments</Text>
                  ) : (
                    attachments.map((a: any, i: number) => (
                      <DetailRow
                        key={`${a?.id || i}`}
                        label={`File ${i + 1}`}
                        value={a?.name || a?.filename || 'Attachment'}
                      />
                    ))
                  )}
                </View>
              )}

              {activeTab === 'activities' && (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>Activities</Text>
                  {activities.length === 0 ? (
                    <Text style={[styles.emptyText, { color: mutedColor }]}>No activity yet</Text>
                  ) : (
                    activities.map((act: any, i: number) => (
                      <DetailRow
                        key={`${act?.id || i}`}
                        label={prettyStatus(act?.toStatus || act?.status || 'updated')}
                        value={formatDate(act?.createdAt)}
                      />
                    ))
                  )}
                </View>
              )}
            </DetailCard>
          </ScrollView>
      </>

      <Modal visible={actionsOpen} transparent animationType="slide" onRequestClose={() => setActionsOpen(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setActionsOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: cardBg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: textColor }]}>Actions</Text>

            <Pressable
              style={[styles.sheetBtn, { borderColor }]}
              onPress={() => updateStatusMutation.mutate('in_progress')}
              disabled={updateStatusMutation.isPending || normalizeStatus(job?.status) === 'in_progress'}
            >
              <Text style={[styles.sheetBtnText, { color: textColor }]}>Mark as In Progress</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetBtn, { borderColor }]}
              onPress={() => updateStatusMutation.mutate('completed')}
              disabled={updateStatusMutation.isPending || normalizeStatus(job?.status) === 'completed'}
            >
              <Text style={[styles.sheetBtnText, { color: textColor }]}>Mark as Completed</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetBtn, { borderColor }]}
              onPress={() => updateStatusMutation.mutate('cancelled')}
              disabled={updateStatusMutation.isPending || normalizeStatus(job?.status) === 'cancelled'}
            >
              <Text style={[styles.sheetBtnText, { color: '#dc2626' }]}>Cancel Job</Text>
            </Pressable>

            <Pressable style={[styles.sheetBtn, { borderColor }]} onPress={() => setActionsOpen(false)}>
              <Text style={[styles.sheetBtnText, { color: mutedColor }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  retryBtn: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  headerActionBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  titleValue: { fontSize: 19, fontWeight: '700', marginBottom: 12 },
  detailList: { gap: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 14, fontWeight: '600', maxWidth: '58%', textAlign: 'right' },
  sectionBlock: { marginTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  itemName: { flex: 1, fontSize: 14, marginRight: 8 },
  itemAmount: { fontSize: 14, fontWeight: '700' },
  emptyText: { fontSize: 13, marginTop: 4 },
  activityRow: { paddingVertical: 10, borderBottomWidth: 1 },
  activityTitle: { fontSize: 14, fontWeight: '600' },
  activityMeta: { fontSize: 12, marginTop: 2 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 14, gap: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  sheetBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12 },
  sheetBtnText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});

