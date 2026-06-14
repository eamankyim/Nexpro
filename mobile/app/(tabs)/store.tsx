import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppIcon } from '@/components/AppIcon';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { ListLoadingState, ListErrorState } from '@/components/ListScreenStates';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/context/AuthContext';
import { useWorkspaceScope } from '@/hooks/useWorkspaceScope';
import { useScreenColors } from '@/hooks/useScreenColors';
import { useOnlineStoreOrderAttention } from '@/hooks/useOnlineStoreOrderAttention';
import { storeService } from '@/services/storeService';
import { resolveBusinessType, STUDIO_LIKE_TYPES } from '@/constants';
import { formatCurrency, formatInteger } from '@/utils/formatCurrency';
import { getApiErrorMessage } from '@/utils/parseApiListResponse';
import { buildStorefrontStoreUrl } from '@/utils/storefrontUrl';
import {
  fulfillmentStateForOrder,
  formatOnlineOrderStatusLabel,
  getCustomerName,
  getOrderNumber,
  getOrderTotal,
} from '@/utils/marketplaceOrderStatus';

const toCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function StoreScreen() {
  const router = useRouter();
  const { activeTenant, activeTenantId, hasFeature } = useAuth();
  const { scopeReady } = useWorkspaceScope();
  const { colors, cardBg, borderColor, textColor, mutedColor } = useScreenColors();

  const resolvedType = resolveBusinessType(activeTenant?.businessType);
  const isStudioStore =
    STUDIO_LIKE_TYPES.includes((activeTenant?.businessType || '') as (typeof STUDIO_LIKE_TYPES)[number])
    || resolvedType === 'studio';

  const enabled = !!activeTenantId && scopeReady && hasFeature('paymentsExpenses');

  const {
    data: statusResponse,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['store', 'setup-status'],
    queryFn: () => storeService.getSetupStatus(),
    enabled,
    staleTime: 60 * 1000,
  });

  const {
    pendingOrderCount,
    recentOrders,
    orderStats,
    isOrderStatsFetching,
    isRecentOrdersLoading,
    isRecentOrdersFetching,
    isRecentOrdersError,
    hasLoadedOrderStats,
  } = useOnlineStoreOrderAttention({ enabled });

  const setupData = (statusResponse as { data?: unknown })?.data ?? statusResponse ?? {};
  const settings = (setupData as { settings?: Record<string, unknown> }).settings || {};
  const checklist = (setupData as { checklist?: Record<string, unknown> }).checklist || {};
  const hasStoreSettings = Boolean(checklist.hasSettings);
  const storefrontUrl = buildStorefrontStoreUrl(String(settings.slug || settings.storeSlug || ''));

  const totalOrders = useMemo(
    () => toCount(orderStats.total ?? recentOrders.length),
    [orderStats.total, recentOrders.length]
  );

  const dashboardStats = useMemo(
    () => [
      {
        label: isStudioStore ? 'Published services' : 'Published listings',
        value: formatInteger(toCount(checklist.listingsCount)),
        description: isStudioStore ? 'Services customers can request' : 'Products customers can buy',
        icon: 'package' as const,
        valueColor: textColor,
      },
      {
        label: isStudioStore ? 'Studio store status' : 'Store status',
        value: checklist.launched ? 'Live' : 'Draft',
        description: checklist.launched ? 'Public storefront is active' : 'Finish setup on web',
        icon: 'shopping-cart' as const,
        valueColor: checklist.launched ? colors.tint : '#b45309',
      },
      {
        label: 'Pending orders',
        value: isOrderStatsFetching && !hasLoadedOrderStats ? '...' : formatInteger(pendingOrderCount),
        description: 'Payment or fulfillment needs attention',
        icon: 'clock' as const,
        valueColor: '#b45309',
      },
      {
        label: 'Online revenue',
        value: isOrderStatsFetching && !hasLoadedOrderStats
          ? '...'
          : formatCurrency(Number(orderStats.totalRevenue || 0)),
        description: `${formatInteger(totalOrders)} online ${totalOrders === 1 ? 'order' : 'orders'} received`,
        icon: 'credit-card' as const,
        valueColor: colors.tint,
      },
    ],
    [
      checklist.launched,
      checklist.listingsCount,
      colors.tint,
      hasLoadedOrderStats,
      isOrderStatsFetching,
      isStudioStore,
      orderStats.totalRevenue,
      pendingOrderCount,
      textColor,
      totalOrders,
    ]
  );

  const openStorefront = useCallback(() => {
    if (!storefrontUrl) {
      Alert.alert('Store not launched', 'Finish store setup on the web app to get your storefront link.');
      return;
    }
    Linking.openURL(storefrontUrl).catch(() => {
      Alert.alert('Could not open link', storefrontUrl);
    });
  }, [storefrontUrl]);

  if (!hasFeature('paymentsExpenses')) {
    return <FeatureAccessDenied message="Online store is not enabled for your workspace." />;
  }

  if (isLoading) {
    return <ListLoadingState message="Loading store..." />;
  }

  if (isError) {
    return (
      <ListErrorState
        title="Failed to load store"
        message={getApiErrorMessage(error, 'Could not load store status.')}
        onRetry={refetch}
      />
    );
  }

  if (!hasStoreSettings) {
    return (
      <ScreenShell scrollable style={styles.container} contentContainerStyle={styles.content}>
        <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor }]}>
          <AppIcon name="shopping-cart" size={32} color={colors.tint} />
          <Text style={[styles.heroTitle, { color: textColor }]}>
            {isStudioStore ? 'Set up your studio store' : 'Set up your online store'}
          </Text>
          <Text style={[styles.heroBody, { color: mutedColor }]}>
            Complete store setup on the web app to publish your {isStudioStore ? 'services' : 'products'} and receive online orders on mobile.
          </Text>
        </View>
      </ScreenShell>
    );
  }

  const displayName = String(settings.displayName || (isStudioStore ? 'Studio store' : 'Online store'));

  return (
    <ScreenShell
      scrollable
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.tint} />
      }
    >
      <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor }]}>
        <Text style={[styles.heroTitle, { color: textColor }]}>{displayName}</Text>
        <Text style={[styles.heroBody, { color: mutedColor }]}>
          {checklist.launched
            ? 'Track storefront performance and orders from mobile.'
            : 'Dashboard preview. Finish launch settings on the web app when ready.'}
        </Text>
        {storefrontUrl ? (
          <Pressable
            onPress={openStorefront}
            style={({ pressed }) => [styles.linkBtn, { borderColor, opacity: pressed ? 0.85 : 1 }]}
          >
            <AppIcon name="share" size={16} color={colors.tint} />
            <Text style={[styles.linkBtnText, { color: colors.tint }]} numberOfLines={1}>
              View storefront
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.statsGrid}>
        {dashboardStats.map((stat) => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.statHeader}>
              <Text style={[styles.statLabel, { color: mutedColor }]}>{stat.label}</Text>
              <AppIcon name={stat.icon} size={16} color={mutedColor} />
            </View>
            <Text style={[styles.statValue, { color: stat.valueColor }]}>{stat.value}</Text>
            <Text style={[styles.statDescription, { color: mutedColor }]}>{stat.description}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Recent online orders</Text>
        <Pressable onPress={() => router.push('/(tabs)/online-orders' as never)}>
          <Text style={{ color: colors.tint, fontWeight: '600', fontSize: 14 }}>See all</Text>
        </Pressable>
      </View>
      <View style={[styles.menuCard, { backgroundColor: cardBg, borderColor }]}>
        {isRecentOrdersLoading || (isRecentOrdersFetching && recentOrders.length === 0) ? (
          <View style={styles.stateCard}>
            <AppIcon name="refresh" size={20} color={mutedColor} />
            <Text style={[styles.stateText, { color: mutedColor }]}>Loading recent online orders...</Text>
          </View>
        ) : isRecentOrdersError ? (
          <View style={[styles.stateCard, { backgroundColor: '#fffbeb' }]}>
            <AppIcon name="exclamation-triangle" size={20} color="#b45309" />
            <Text style={[styles.stateText, { color: '#92400e' }]}>
              Could not load recent online orders. Open orders to try again.
            </Text>
          </View>
        ) : recentOrders.length === 0 ? (
          <View style={styles.stateCard}>
            <AppIcon name="shopping-cart" size={22} color={mutedColor} />
            <Text style={[styles.stateTitle, { color: textColor }]}>No online orders yet</Text>
            <Text style={[styles.stateText, { color: mutedColor }]}>
              Share your storefront link and new orders will appear here.
            </Text>
          </View>
        ) : (
          recentOrders.slice(0, 3).map((order, index) => {
            const fulfillment = fulfillmentStateForOrder(order);
            return (
              <Pressable
                key={String(order.id)}
                onPress={() => router.push(`/store-order/${order.id}` as never)}
                style={({ pressed }) => [
                  styles.recentRow,
                  index < Math.min(recentOrders.length, 3) - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.recentMain}>
                  <Text style={[styles.recentTitle, { color: textColor }]} numberOfLines={1}>
                    {getOrderNumber(order)}
                  </Text>
                  <Text style={[styles.recentSub, { color: mutedColor }]} numberOfLines={1}>
                    {getCustomerName(order)} · {formatOnlineOrderStatusLabel(fulfillment)}
                  </Text>
                </View>
                <Text style={[styles.recentTotal, { color: colors.tint }]}>
                  {formatCurrency(getOrderTotal(order))}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Quick links</Text>
      </View>
      <View style={[styles.menuCard, { backgroundColor: cardBg, borderColor }]}>
        <Pressable
          onPress={() => router.push('/(tabs)/online-orders' as never)}
          style={({ pressed }) => [styles.menuRow, { borderBottomColor: borderColor, opacity: pressed ? 0.85 : 1 }]}
        >
          <AppIcon name="shopping-cart" size={20} color={colors.tint} />
          <Text style={[styles.menuLabel, { color: textColor }]}>Online orders</Text>
          <AppIcon name="chevron-right" size={14} color={mutedColor} />
        </Pressable>
        {isStudioStore ? (
          <Pressable
            onPress={() => router.push('/(tabs)/store-services' as never)}
            style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.85 : 1 }]}
          >
            <AppIcon name="cut-outline" size={20} color={colors.tint} />
            <Text style={[styles.menuLabel, { color: textColor }]}>Studio services</Text>
            <AppIcon name="chevron-right" size={14} color={mutedColor} />
          </Pressable>
        ) : null}
      </View>

      {!checklist.launched ? (
        <View style={[styles.noteCard, { backgroundColor: cardBg, borderColor }]}>
          <AppIcon name="info" size={18} color={mutedColor} />
          <Text style={[styles.noteText, { color: mutedColor }]}>
            Store launch settings stay on the web app. Mobile focuses on stats and order follow-up.
          </Text>
        </View>
      ) : null}

      {pendingOrderCount > 0 ? (
        <Pressable
          onPress={() => router.push('/(tabs)/online-orders' as never)}
          style={({ pressed }) => [
            styles.alertCard,
            { backgroundColor: '#fffbeb', borderColor: '#fde68a', opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <AppIcon name="bell" size={20} color="#b45309" />
          <View style={styles.alertTextCol}>
            <Text style={styles.alertTitle}>
              {pendingOrderCount} online {pendingOrderCount === 1 ? 'order needs' : 'orders need'} attention
            </Text>
            <Text style={styles.alertBody}>Review and fulfill pending online store orders</Text>
          </View>
          <AppIcon name="chevron-right" size={16} color="#b45309" />
        </Pressable>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  heroCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  heroTitle: { fontSize: 20, fontWeight: '700' },
  heroBody: { fontSize: 14, lineHeight: 20 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  linkBtnText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { width: '48.5%', minHeight: 132, borderWidth: 1, borderRadius: 12, padding: 14 },
  statHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statLabel: { fontSize: 12, marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statDescription: { fontSize: 12, lineHeight: 16, marginTop: 6 },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  alertTextCol: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  alertBody: { fontSize: 13, color: '#b45309', marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  menuCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 0,
  },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  stateCard: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 22 },
  stateTitle: { fontSize: 15, fontWeight: '700' },
  stateText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  recentMain: { flex: 1 },
  recentTitle: { fontSize: 15, fontWeight: '600' },
  recentSub: { fontSize: 12, marginTop: 2 },
  recentTotal: { fontSize: 14, fontWeight: '700' },
});
