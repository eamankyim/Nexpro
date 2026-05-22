import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { ListEmptyState, EmptyStateActionButton, ListActionButton } from '@/components/ListEmptyState';
import { useAuth } from '@/context/AuthContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { jobService } from '@/services/jobService';
import { SEARCH_PLACEHOLDERS } from '@/constants/searchPlaceholders';
import { useSmartSearch } from '@/context/SmartSearchContext';
import { useRegisterPageSearch } from '@/hooks/useRegisterPageSearch';
import { useDebounce } from '@/hooks/useDebounce';
import { CURRENCY } from '@/constants';
import { formatCurrency } from '@/utils/formatCurrency';
import { resolveBusinessType } from '@/constants';
import { getApiErrorMessage, parseApiListResponse } from '@/utils/parseApiListResponse';
import { formatStatusLabel } from '@/utils/formatLabels';
import { showListFilters } from '@/utils/listEmptyLayout';
import { ListLoadingState, ListErrorState } from '@/components/ListScreenStates';

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
  const params = useLocalSearchParams<{ openJobId?: string }>();
  const { activeTenant, activeTenantId, hasFeature } = useAuth();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor, inputBg } = useScreenColors();

  const resolvedType = resolveBusinessType(activeTenant?.businessType);
  const isStudio = resolvedType === 'studio';
  const { searchValue } = useSmartSearch();
  useRegisterPageSearch({ scope: 'jobs', placeholder: SEARCH_PLACEHOLDERS.JOBS });
  const debouncedSearch = useDebounce(searchValue, 400);

  const { data: response, isLoading, refetch, isRefetching, error, isError } = useQuery({
    queryKey: ['jobs', activeTenantId, debouncedSearch],
    queryFn: async () => {
      const params: { page?: number; limit?: number; search?: string } = {
        page: 1,
        limit: 50,
        search: debouncedSearch || undefined,
      };
      return jobService.getJobs(params);
    },
    enabled: !!activeTenantId && isStudio && hasFeature('jobAutomation'),
    staleTime: 2 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const jobs = useMemo(() => parseApiListResponse<Job>(response), [response]);
  const loadErrorMessage = useMemo(
    () => getApiErrorMessage(error, 'Could not load jobs. Pull to refresh.'),
    [error]
  );
  const openJobId = typeof params.openJobId === 'string' ? params.openJobId : null;

  const totalJobs = jobs.length;
  const inProgressJobs = jobs.filter((j) => j.status === 'in_progress').length;
  const completedJobs = jobs.filter((j) => j.status === 'completed').length;
  const overdueJobs = jobs.filter((j) => {
    if (!j.dueDate) return false;
    const due = new Date(j.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today && j.status !== 'completed' && j.status !== 'cancelled';
  }).length;
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const handleJobPress = useCallback((job: Job) => {
    router.push(`/job/${encodeURIComponent(job.id)}` as any);
  }, [router]);

  useEffect(() => {
    if (!openJobId || jobs.length === 0) return;
    const target = jobs.find((j) => j.id === openJobId);
    if (target) {
      router.push(`/job/${encodeURIComponent(target.id)}` as any);
    }
  }, [openJobId, jobs, router]);

  const handleCreateJob = useCallback(() => {
    router.push('/(tabs)/scan');
  }, [router]);


  if (!isStudio) {
    return <FeatureAccessDenied message="Jobs are only available for studio-type workspaces." />;
  }
  if (!hasFeature('jobAutomation')) {
    return <FeatureAccessDenied message="Jobs are not enabled for this workspace." />;
  }

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
    <ScreenShell style={styles.container}>
      {!isLoading && !isError && jobs.length > 0 && (
        <ListActionButton
          label="New Job"
          onPress={handleCreateJob}
          backgroundColor={colors.tint}
        />
      )}

      {/* Stats cards (match web Jobs summary with icons) */}
      {showListFilters(isLoading, isError, jobs.length) && (
      <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.statHeader}>
              <Text style={[styles.statLabel, { color: mutedColor }]}>Total Jobs</Text>
              <View style={[styles.statIconWrap, { backgroundColor: 'rgba(22, 101, 52, 0.1)' }]}>
                <AppIcon name="briefcase" size={16} color={colors.tint} />
              </View>
            </View>
            <Text style={[styles.statValue, { color: textColor }]}>{totalJobs}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.statHeader}>
              <Text style={[styles.statLabel, { color: mutedColor }]}>In Progress</Text>
              <View style={[styles.statIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <AppIcon name="clock-o" size={16} color={colors.tint} />
              </View>
            </View>
            <Text style={[styles.statValue, { color: textColor }]}>{inProgressJobs}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.statHeader}>
              <Text style={[styles.statLabel, { color: mutedColor }]}>Completed</Text>
              <View style={[styles.statIconWrap, { backgroundColor: 'rgba(132, 204, 22, 0.1)' }]}>
                <AppIcon name="check-circle" size={16} color="#84cc16" />
              </View>
            </View>
            <Text style={[styles.statValue, { color: textColor }]}>{completedJobs}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.statHeader}>
              <Text style={[styles.statLabel, { color: mutedColor }]}>Overdue</Text>
              <View style={[styles.statIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <AppIcon name="exclamation-circle" size={16} color="#ef4444" />
              </View>
            </View>
            <Text style={[styles.statValue, { color: textColor }]}>{overdueJobs}</Text>
          </View>
        </View>
      )}

      {isLoading && !response ? (
        <ListLoadingState message="Loading jobs..." />
      ) : isError ? (
        <ListErrorState title="Failed to load jobs" message={loadErrorMessage} onRetry={refetch} />
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
            <ListEmptyState
              imageKey="TASKS"
              title="No jobs yet"
              subtitle="Create your first job to get started"
              titleColor={textColor}
              subtitleColor={mutedColor}
            >
              <EmptyStateActionButton
                label="New Job"
                onPress={handleCreateJob}
                backgroundColor={colors.tint}
              />
            </ListEmptyState>
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
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
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
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },
});
