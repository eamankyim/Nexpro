import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { dashboardService } from '@/services/dashboardService';
import { authService } from '@/services/auth';
import { CURRENCY, STUDIO_TYPES, DEFAULT_TENANT_NAMES } from '@/constants';
import Colors from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';

type FilterType = 'today' | 'week' | 'month' | 'year';

function formatDateRange(filterType: FilterType): { start: string; end: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  let start: Date;

  if (filterType === 'today') {
    start = new Date(today);
  } else if (filterType === 'week') {
    start = new Date(today);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
  } else if (filterType === 'month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else {
    start = new Date(today.getFullYear(), 0, 1);
  }
  start.setHours(0, 0, 0, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function formatCurrency(value: number): string {
  return `${CURRENCY.SYMBOL} ${(value ?? 0).toFixed(CURRENCY.DECIMAL_PLACES)}`;
}

function getDueDateBadge(
  dueDate: string | null | undefined
): { label: string; bg: string; text: string; border: string } {
  if (!dueDate) {
    return { label: 'No due date', bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return { label: 'No due date', bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
  }

  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const absHours = Math.abs(diffHours);

  if (diffHours < 0) {
    const daysOverdue = Math.max(1, Math.round(absHours / 24));
    return {
      label: `Overdue ${daysOverdue}d`,
      bg: '#fee2e2',
      text: '#b91c1c',
      border: '#fca5a5',
    };
  }

  if (diffHours <= 24) {
    return {
      label: `Due in ${Math.max(1, diffHours)}h`,
      bg: '#ffedd5',
      text: '#c2410c',
      border: '#fdba74',
    };
  }

  const days = Math.max(1, Math.round(diffHours / 24));
  return {
    label: `Due in ${days}d`,
    bg: '#dcfce7',
    text: '#166534',
    border: '#86efac',
  };
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, activeTenant, activeTenantId, wasInvited, refreshAuth } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];

  const [filterType, setFilterType] = useState<FilterType>('today');
  const [resendLoading, setResendLoading] = useState(false);
  const dateRange = useMemo(() => formatDateRange(filterType), [filterType]);

  const hasBusinessName = useMemo(() => {
    const name = activeTenant?.name;
    return !!(name && typeof name === 'string' && name.trim() && !DEFAULT_TENANT_NAMES.includes(name));
  }, [activeTenant?.name]);

  const hasCompanyPhone = useMemo(() => {
    return !!(activeTenant?.metadata?.phone && String(activeTenant.metadata.phone).trim());
  }, [activeTenant?.metadata?.phone]);

  const onboardingCompleted = useMemo(() => {
    if (activeTenant?.metadata?.onboarding?.completedAt) return true;
    return hasBusinessName && hasCompanyPhone;
  }, [activeTenant?.metadata?.onboarding?.completedAt, hasBusinessName, hasCompanyPhone]);

  const showSetupBanner = useMemo(() => !onboardingCompleted && !wasInvited, [onboardingCompleted, wasInvited]);
  const showVerifyEmailBanner = useMemo(() => Boolean(user && !user.emailVerifiedAt), [user, user?.emailVerifiedAt]);

  const handleResendVerification = useCallback(async () => {
    setResendLoading(true);
    try {
      await authService.resendVerification();
      Alert.alert('Done', 'Verification email sent. Check your inbox.');
      await refreshAuth();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to send. Try again later.';
      Alert.alert('Error', msg);
    } finally {
      setResendLoading(false);
    }
  }, [refreshAuth]);

  const { data: overviewResponse, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', 'overview', activeTenantId, dateRange.start, dateRange.end, filterType],
    queryFn: () =>
      dashboardService.getOverview(dateRange.start, dateRange.end, filterType),
    enabled: !!activeTenantId, // Only fetch when we have an active tenant
    // Dashboard data can be stale for 2 minutes (frequent updates but not real-time critical)
    staleTime: 2 * 60 * 1000,
    // Keep in cache for 1 hour
    gcTime: 60 * 60 * 1000,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const businessType = activeTenant?.businessType ?? 'printing_press';
  const isShop = businessType === 'shop';
  const isPharmacy = businessType === 'pharmacy';
  const isStudio = STUDIO_TYPES.includes(businessType);
  const isPrintingPress = businessType === 'printing_press';

  // Match web app pattern: overviewResponse?.data || overviewResponse
  const overview = overviewResponse?.data || overviewResponse;
  const summary = overview?.summary ?? {};
  const currentMonth = overview?.currentMonth ?? overview?.thisMonth ?? {};
  const filteredPeriod = overview?.filteredPeriod;
  const recentJobs = overview?.recentJobs ?? [];
  const shopData = overview?.shopData ?? {};

  const revenue = filteredPeriod?.revenue ?? (isShop || isPharmacy ? shopData.monthSales : currentMonth.revenue) ?? 0;
  const expenses = filteredPeriod?.expenses ?? currentMonth.expenses ?? 0;
  const profit = filteredPeriod?.profit ?? currentMonth.profit ?? revenue - expenses;
  const lowStockItems = shopData.lowStockItems ?? 0;

  const quickActions = useMemo(() => {
    const actions: { label: string; icon: React.ComponentProps<typeof FontAwesome>['name']; route: string }[] = [];
    if (isShop || isPharmacy) {
      actions.push({ label: 'Point of Sale', icon: 'shopping-cart', route: '/(tabs)/scan' });
      actions.push({ label: 'Add customer', icon: 'user-plus', route: '/(tabs)/customers?add=1' });
    }
    if (isStudio) {
      actions.push({ label: 'New job', icon: 'plus', route: '/(tabs)/scan' });
      actions.push({ label: 'Add customer', icon: 'user-plus', route: '/(tabs)/customers?add=1' });
      if (isPrintingPress) {
        actions.push({ label: 'New quote', icon: 'file-text-o', route: '/(tabs)/quotes' });
      }
    }
    if (isShop || isPharmacy) {
      actions.push({ label: 'Restock', icon: 'archive', route: '/(tabs)/scan' });
    }
    return actions;
  }, [isShop, isPharmacy, isStudio, isPrintingPress]);

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  if (isLoading && !overviewResponse) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!activeTenantId) {
    return (
      <View style={[styles.center, { backgroundColor: bg, padding: 24 }]}>
        <Text style={[styles.welcome, { color: textColor, marginBottom: 8 }]}>
          No Active Workspace
        </Text>
        <Text style={[styles.subtitle, { color: mutedColor, textAlign: 'center' }]}>
          Please select a workspace from Settings to view your dashboard.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
      }
    >
      <Text style={[styles.welcome, { color: textColor }]}>
        Welcome{user?.name ? `, ${user.name}` : ''}
      </Text>

      {/* Verify email banner (matches web MainLayout) */}
      {showVerifyEmailBanner && (
        <View style={styles.verifyBanner}>
          <Ionicons name="mail-outline" size={20} color="#b45309" />
          <View style={styles.verifyBannerText}>
            <Text style={styles.verifyBannerTitle}>Verify your email</Text>
            <Text style={styles.verifyBannerSubtitle}>
              We sent a link to your email. Click it to verify, or resend below.
            </Text>
          </View>
          <Pressable
            style={styles.verifyBannerButton}
            onPress={handleResendVerification}
            disabled={resendLoading}
          >
            {resendLoading ? (
              <ActivityIndicator size="small" color="#b45309" />
            ) : (
              <Text style={styles.verifyBannerButtonText}>Resend link</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Complete onboarding banner (mobile-friendly card) */}
      {showSetupBanner && (
        <Pressable
          style={[styles.setupBanner, { backgroundColor: cardBg, borderColor }]}
          onPress={() => router.push('/onboarding' as any)}
        >
          <View style={styles.setupBannerIcon}>
            <Ionicons name="sparkles" size={22} color="#166534" />
          </View>
          <View style={styles.setupBannerText}>
            <Text style={styles.setupBannerTitle}>Finish setting up your business</Text>
            <Text style={styles.setupBannerSubtitle}>
              Complete your business profile to get the most out of African Business Suite.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={mutedColor} />
        </Pressable>
      )}

      {/* Date filter */}
      <View style={styles.filterRow}>
        {(['today', 'week', 'month', 'year'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilterType(f)}
            style={[
              styles.filterBtn,
              { borderColor },
              filterType === f && { backgroundColor: colors.tint, borderColor: colors.tint },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: filterType === f ? '#fff' : textColor },
              ]}
            >
              {f === 'today'
                ? 'Today'
                : f === 'week'
                  ? 'This Week'
                  : f === 'month'
                    ? 'This Month'
                    : 'This Year'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Stats cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
          <FontAwesome name="money" size={20} color={colors.tint} />
          <Text style={[styles.statValue, { color: textColor }]}>{formatCurrency(revenue)}</Text>
          <Text style={[styles.statLabel, { color: mutedColor }]}>Revenue</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
          <FontAwesome name="minus-circle" size={20} color="#dc2626" />
          <Text style={[styles.statValue, { color: textColor }]}>{formatCurrency(expenses)}</Text>
          <Text style={[styles.statLabel, { color: mutedColor }]}>Expenses</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
          <FontAwesome name="line-chart" size={20} color={profit >= 0 ? '#16a34a' : '#dc2626'} />
          <Text style={[styles.statValue, { color: textColor }]}>{formatCurrency(profit)}</Text>
          <Text style={[styles.statLabel, { color: mutedColor }]}>Profit</Text>
        </View>
        {(isShop || isPharmacy) && (
          <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
            <FontAwesome name="user-plus" size={20} color={colors.tint} />
            <Text style={[styles.statValue, { color: textColor }]}>{summary.newCustomers ?? 0}</Text>
            <Text style={[styles.statLabel, { color: mutedColor }]}>New customers</Text>
          </View>
        )}
      </View>

      {/* Low stock alert */}
      {(isShop || isPharmacy) && lowStockItems > 0 && (
        <Pressable
          style={[styles.alertCard, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}
          onPress={() => router.push('/(tabs)/scan' as any)}
        >
          <FontAwesome name="exclamation-triangle" size={20} color="#d97706" />
          <Text style={styles.alertText}>
            {lowStockItems} item{lowStockItems !== 1 ? 's' : ''} low on stock
          </Text>
        </Pressable>
      )}

      {/* Quick actions */}
      <Text style={[styles.sectionTitle, { color: textColor }]}>Quick actions</Text>
      <View style={styles.actionsRow}>
        {quickActions.map((action) => (
          <Pressable
            key={action.label}
            onPress={() => router.push(action.route as any)}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: cardBg, borderColor },
              pressed && styles.pressed,
            ]}
          >
            <FontAwesome name={action.icon} size={24} color={colors.tint} />
            <Text style={[styles.actionLabel, { color: textColor }]} numberOfLines={1}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Recent jobs (studio) */}
      {isStudio && recentJobs.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: textColor }]}>In progress</Text>
          <View style={[styles.jobsCard, { backgroundColor: cardBg, borderColor }]}>
            {recentJobs.slice(0, 5).map((job: { id: string; title: string; jobNumber?: string; status: string; dueDate?: string; customer?: { name: string } }) => (
              <Pressable
                key={job.id}
                style={({ pressed }) => [styles.jobRow, pressed && styles.pressed]}
                onPress={() => router.push(`/(tabs)/jobs?openJobId=${encodeURIComponent(job.id)}` as any)}
              >
                <View style={styles.jobInfo}>
                  <Text style={[styles.jobTitle, { color: textColor }]} numberOfLines={1}>
                    {job.jobNumber || job.title}
                  </Text>
                  <Text style={[styles.jobCustomer, { color: mutedColor }]} numberOfLines={1}>
                    {job.customer?.name ?? '—'}
                  </Text>
                </View>
                <View style={styles.jobRight}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: getDueDateBadge(job.dueDate).bg,
                        borderColor: getDueDateBadge(job.dueDate).border,
                      },
                    ]}
                  >
                    <Text style={[styles.statusBadgeText, { color: getDueDateBadge(job.dueDate).text }]}>
                      {getDueDateBadge(job.dueDate).label}
                    </Text>
                  </View>
                  <FontAwesome name="chevron-right" size={14} color={mutedColor} />
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  welcome: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.5)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  verifyBannerText: { flex: 1, minWidth: 0 },
  verifyBannerTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  verifyBannerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  verifyBannerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.5)',
    minWidth: 90,
    alignItems: 'center',
  },
  verifyBannerButtonText: { fontSize: 14, fontWeight: '600', color: '#b45309' },
  setupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  setupBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#a3e635',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupBannerText: { flex: 1, minWidth: 0 },
  setupBannerTitle: { fontSize: 15, fontWeight: '600' },
  setupBannerSubtitle: { fontSize: 13, marginTop: 4 },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    width: '30%',
    minWidth: 90,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  jobsCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  jobCustomer: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  jobRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
