import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { dashboardService } from '@/services/dashboardService';
import { CURRENCY, STUDIO_TYPES } from '@/constants';
import Colors from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';

type FilterType = 'today' | 'week' | 'month';

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
  } else {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
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

export default function DashboardScreen() {
  const router = useRouter();
  const { user, activeTenant, activeTenantId } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];

  const [filterType, setFilterType] = useState<FilterType>('today');
  const dateRange = useMemo(() => formatDateRange(filterType), [filterType]);

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
    }
    if (isShop || isPharmacy) {
      actions.push({ label: 'Restock', icon: 'archive', route: '/(tabs)/scan' });
    }
    return actions;
  }, [isShop, isPharmacy, isStudio]);

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

      {/* Date filter */}
      <View style={styles.filterRow}>
        {(['today', 'week', 'month'] as const).map((f) => (
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
              {f.charAt(0).toUpperCase() + f.slice(1)}
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
            {recentJobs.slice(0, 5).map((job: { id: string; title: string; jobNumber?: string; status: string; customer?: { name: string } }) => (
              <Pressable
                key={job.id}
                style={({ pressed }) => [styles.jobRow, pressed && styles.pressed]}
              >
                <View style={styles.jobInfo}>
                  <Text style={[styles.jobTitle, { color: textColor }]} numberOfLines={1}>
                    {job.jobNumber || job.title}
                  </Text>
                  <Text style={[styles.jobCustomer, { color: mutedColor }]} numberOfLines={1}>
                    {job.customer?.name ?? '—'}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={14} color={mutedColor} />
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
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
