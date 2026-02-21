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
import { useTheme } from '@/context/ThemeContext';
import { jobService } from '@/services/jobService';
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

function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    new: '#3b82f6',
    in_progress: '#f59e0b',
    completed: '#10b981',
    on_hold: '#6b7280',
    cancelled: '#ef4444',
  };
  return statusColors[status] || '#6b7280';
}

function getPriorityColor(priority: string): string {
  const priorityColors: Record<string, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    urgent: '#dc2626',
  };
  return priorityColors[priority] || '#6b7280';
}

type Job = {
  id: string;
  jobNumber?: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  createdAt: string;
  customer?: { id: string; name?: string; phone?: string };
  total?: number;
};

export default function JobsScreen() {
  const router = useRouter();
  const { activeTenant, activeTenantId, user } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [detailJob, setDetailJob] = useState<Job | null>(null);

  const resolvedType = resolveBusinessType(activeTenant?.businessType);
  const isStudio = resolvedType === 'studio';

  const { data: response, isLoading, refetch, isRefetching, error, isError } = useQuery({
    queryKey: ['jobs', activeTenantId, statusFilter, priorityFilter],
    queryFn: async () => {
      const params: { page?: number; limit?: number; status?: string; priority?: string } = {
        page: 1,
        limit: 20,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      return jobService.getJobs(params);
    },
    enabled: !!activeTenantId && isStudio,
    staleTime: 2 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const jobs = (response?.data || []) as Job[];
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const handleJobPress = useCallback(async (job: Job) => {
    setSelectedJob(job);
    try {
      const res = await jobService.getJobById(job.id);
      const full = res?.data || res;
      setDetailJob(full as Job);
    } catch {
      setDetailJob(job);
    }
  }, []);

  const handleCreateJob = useCallback(() => {
    router.push('/(tabs)/scan');
  }, [router]);

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  const renderJobItem = ({ item }: { item: Job }) => {
    const statusColor = getStatusColor(item.status);
    const priorityColor = item.priority ? getPriorityColor(item.priority) : null;

    return (
      <Pressable
        onPress={() => handleJobPress(item)}
        style={({ pressed }) => [
          styles.jobCard,
          { backgroundColor: cardBg, borderColor },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.jobRow}>
          <View style={styles.jobInfo}>
            <Text style={[styles.jobNumber, { color: textColor }]}>
              {item.jobNumber || `#${item.id.slice(0, 8)}`}
            </Text>
            <Text style={[styles.jobTitle, { color: textColor }]} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
          {item.total && (
            <Text style={[styles.jobTotal, { color: colors.tint }]}>
              {formatCurrency(item.total)}
            </Text>
          )}
        </View>
        <Text style={[styles.jobCustomer, { color: mutedColor }]} numberOfLines={1}>
          {item.customer?.name ?? '—'}
        </Text>
        <View style={styles.jobMeta}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.replace('_', ' ')}
            </Text>
          </View>
          {item.priority && (
            <View style={[styles.priorityBadge, { backgroundColor: (priorityColor ?? '#6b7280') + '20' }]}>
              <Text style={[styles.priorityText, { color: priorityColor ?? '#6b7280' }]}>
                {item.priority}
              </Text>
            </View>
          )}
          {item.dueDate && (
            <Text style={[styles.dueDate, { color: mutedColor }]}>
              Due {formatDate(item.dueDate)}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  if (!isStudio) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.emptyTitle, { color: textColor }]}>Jobs</Text>
        <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
          Jobs are available for studio business types (Printing Press, Mechanic, Barber, Salon).
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Create Job button */}
      <Pressable
        onPress={handleCreateJob}
        style={[styles.createButton, { backgroundColor: colors.tint }]}
      >
        <FontAwesome name="plus" size={20} color="#fff" />
        <Text style={styles.createButtonText}>New Job</Text>
      </Pressable>

      {/* Status filter */}
      <View style={styles.filterRow}>
        {['all', 'new', 'in_progress', 'completed', 'on_hold'].map((s) => (
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
              {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Priority filter */}
      <View style={styles.filterRow}>
        {['all', 'low', 'medium', 'high', 'urgent'].map((p) => (
          <Pressable
            key={p}
            onPress={() => setPriorityFilter(p)}
            style={[
              styles.filterBtn,
              { borderColor },
              priorityFilter === p && { backgroundColor: colors.tint, borderColor: colors.tint },
            ]}
          >
            <Text style={[styles.filterText, { color: priorityFilter === p ? '#fff' : textColor }]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: mutedColor }]}>Loading jobs...</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <FontAwesome name="exclamation-triangle" size={48} color="#ef4444" />
          <Text style={[styles.emptyTitle, { color: textColor }]}>Failed to load jobs</Text>
          <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
            {error?.message?.includes('timeout')
              ? 'Request timed out. Please check your connection and try again.'
              : 'An error occurred while loading jobs. Please try again.'}
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
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJobItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="briefcase" size={48} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No jobs yet</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                Create your first job to get started
              </Text>
            </View>
          }
        />
      )}

      {/* Job detail modal */}
      <Modal
        visible={!!selectedJob}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedJob(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedJob(null)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                {detailJob?.jobNumber || selectedJob?.jobNumber || 'Job details'}
              </Text>
              <Pressable onPress={() => setSelectedJob(null)} hitSlop={12}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            {detailJob && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Title</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>{detailJob.title}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Customer</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {detailJob.customer?.name ?? '—'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(detailJob.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(detailJob.status) }]}>
                      {detailJob.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
                {detailJob.priority && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Priority</Text>
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(detailJob.priority) + '20' }]}>
                      <Text style={[styles.priorityText, { color: getPriorityColor(detailJob.priority) }]}>
                        {detailJob.priority}
                      </Text>
                    </View>
                  </View>
                )}
                {detailJob.dueDate && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Due Date</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {formatDate(detailJob.dueDate)}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Created</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {formatDate(detailJob.createdAt)}
                  </Text>
                </View>
                {detailJob.total && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Total</Text>
                    <Text style={[styles.detailValue, { color: colors.tint, fontSize: 18, fontWeight: '700' }]}>
                      {formatCurrency(detailJob.total)}
                    </Text>
                  </View>
                )}
                {(detailJob as any).items?.length > 0 && (
                  <>
                    <Text style={[styles.detailSection, { color: textColor }]}>Items</Text>
                    {(detailJob as any).items.map(
                      (
                        item: { description: string; quantity: number; unitPrice: number },
                        i: number
                      ) => (
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    padding: 14,
    borderRadius: 12,
  },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  filterText: { fontSize: 14, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  jobCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  jobRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  jobInfo: { flex: 1, marginRight: 12 },
  jobNumber: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  jobTitle: { fontSize: 16, fontWeight: '600' },
  jobTotal: { fontSize: 16, fontWeight: '700' },
  jobCustomer: { fontSize: 14, marginTop: 8 },
  jobMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  priorityText: { fontSize: 12, fontWeight: '600' },
  dueDate: { fontSize: 12 },
  pressed: { opacity: 0.8 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
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
});
