import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { AppIcon } from '@/components/AppIcon';
import { ListEmptyState } from '@/components/ListEmptyState';
import { ListSkeletonState, ListErrorState } from '@/components/ListScreenStates';
import { flatListStyleForEmpty, listContentStyleWhenEmpty } from '@/utils/listEmptyLayout';
import { notificationService } from '@/services/notificationService';
import { useAuth } from '@/context/AuthContext';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { getApiErrorMessage } from '@/utils/parseApiListResponse';

type Notification = {
  id: string;
  title: string;
  message?: string;
  type?: string;
  isRead: boolean;
  createdAt: string;
  metadata?: {
    source?: string;
    saleId?: string;
    saleNumber?: string;
  };
  link?: string;
};

type NotificationStatus = 'onlineOrder' | 'outOfStock' | 'lowStock' | 'default';

type NotificationListItem =
  | { kind: 'section'; id: string; title: string }
  | { kind: 'notification'; id: string; notification: Notification };

const STATUS_STYLES: Record<
  NotificationStatus,
  { dot: string; time: string; background: string }
> = {
  onlineOrder: { dot: '#22c55e', time: '#15803d', background: '#fcfefd' },
  outOfStock: { dot: '#f97316', time: '#ea580c', background: '#fffaf5' },
  lowStock: { dot: '#eab308', time: '#ca8a04', background: '#fffdf2' },
  default: { dot: '#22c55e', time: '#15803d', background: '#ffffff' },
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
  );
}

function getNotificationStatus(item: Notification): NotificationStatus {
  const text = `${item.type || ''} ${item.title || ''} ${item.message || ''}`.toLowerCase();
  const link = String(item.link || '').toLowerCase();

  if (item.metadata?.source === 'online_store' || link.includes('/store/orders') || text.includes('online store order')) {
    return 'onlineOrder';
  }
  if (text.includes('out of stock')) return 'outOfStock';
  if (text.includes('low on stock') || text.includes('low stock') || text.includes('reorder')) return 'lowStock';
  return 'default';
}

function renderHighlightedMessage(message: string, mutedColor: string, highlightColor: string) {
  const parts = message.split(/(Online Orders)/gi);

  return parts.map((part, index) => {
    const isHighlight = part.toLowerCase() === 'online orders';
    return (
      <Text
        key={`${part}-${index}`}
        style={isHighlight ? { color: highlightColor, fontWeight: '500' } : { color: mutedColor }}
      >
        {part}
      </Text>
    );
  });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeTenantId } = useAuth();
  const { colors, cardBg, borderColor, textColor, mutedColor, headerBg, resolvedTheme } = useScreenColors();
  const queryClient = useQueryClient();

  const { data: response, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['notifications', activeTenantId],
    queryFn: () => notificationService.getNotifications({ page: 1, limit: 30 }),
    enabled: !!activeTenantId,
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const loadErrorMessage = getApiErrorMessage(error, 'Could not load notifications.');

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications: Notification[] = Array.isArray(response?.data) ? response.data : [];
  const onRefresh = useCallback(() => refetch(), [refetch]);
  const listData = useMemo<NotificationListItem[]>(() => {
    const today = notifications.filter((notification) => isToday(notification.createdAt));
    const earlier = notifications.filter((notification) => !isToday(notification.createdAt));
    const items: NotificationListItem[] = [];

    if (today.length > 0) {
      items.push({ kind: 'section', id: 'section-today', title: 'Today' });
      today.forEach((notification) => items.push({ kind: 'notification', id: notification.id, notification }));
    }

    if (earlier.length > 0) {
      items.push({ kind: 'section', id: 'section-earlier', title: 'Earlier' });
      earlier.forEach((notification) => items.push({ kind: 'notification', id: notification.id, notification }));
    }

    return items;
  }, [notifications]);

  const handleNotificationPress = useCallback(
    (item: Notification) => {
      if (!item.isRead) markReadMutation.mutate(item.id);

      const saleId = item.metadata?.saleId;
      const isOnlineStore =
        item.metadata?.source === 'online_store'
        || String(item.link || '').includes('/store/orders');

      if (isOnlineStore && saleId) {
        router.push(`/store-order/${saleId}` as never);
      }
    },
    [markReadMutation, router]
  );

  const renderItem = useCallback(({ item }: { item: NotificationListItem }) => {
    if (item.kind === 'section') {
      return (
        <Text style={[styles.sectionTitle, { color: mutedColor }]}>
          {item.title}
        </Text>
      );
    }

    const notification = item.notification;
    const status = getNotificationStatus(notification);
    const statusStyle = STATUS_STYLES[status];
    const backgroundColor = resolvedTheme === 'dark' ? cardBg : statusStyle.background;

    return (
      <Pressable
        onPress={() => handleNotificationPress(notification)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor, borderColor },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.cardRow}>
          <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
          <View style={styles.content}>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
              {notification.title}
            </Text>
            {notification.message ? (
              <Text style={styles.message} numberOfLines={3}>
                {renderHighlightedMessage(notification.message, mutedColor, colors.tint)}
              </Text>
            ) : null}
            <Text style={[styles.time, { color: statusStyle.time }]}>
              {formatTime(notification.createdAt)}
            </Text>
          </View>
          <AppIcon name="chevron-right" size={22} color={mutedColor} />
        </View>
      </Pressable>
    );
  }, [borderColor, cardBg, colors.tint, handleNotificationPress, mutedColor, resolvedTheme, textColor]);

  const hasUnread = notifications.some((n) => !n.isRead);
  const isEmpty = notifications.length === 0;

  return (
    <ScreenShell style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.header,
          {
            backgroundColor: headerBg,
            borderBottomColor: borderColor,
            paddingTop: insets.top > 0 ? insets.top : 12,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <AppIcon name="chevron-left" size={24} color={colors.tint} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>
          Notifications
        </Text>
        <Pressable
          onPress={() => markAllReadMutation.mutate()}
          disabled={!hasUnread || markAllReadMutation.isPending}
          style={({ pressed }) => [
            styles.markAllButton,
            (!hasUnread || markAllReadMutation.isPending) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.markAllText, { color: colors.tint }]}>
            Mark all read
          </Text>
        </Pressable>
      </View>
      {isLoading ? (
        <ListSkeletonState rows={6} message="Loading notifications..." />
      ) : isError ? (
        <ListErrorState
          title="Failed to load notifications"
          message={loadErrorMessage}
          onRetry={refetch}
        />
      ) : (
        <FlatList
          style={flatListStyleForEmpty}
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={listContentStyleWhenEmpty(styles.list, isEmpty)}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          ListEmptyComponent={
            <ListEmptyState
              imageKey="NOTIFICATIONS"
              title="No notifications"
              subtitle="You're all caught up"
            />
          }
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 104,
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 16,
    justifyContent: 'flex-end',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    bottom: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    position: 'absolute',
    left: 116,
    right: 116,
    bottom: 20,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  markAllButton: {
    position: 'absolute',
    right: 16,
    bottom: 10,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  markAllText: { fontSize: 14, fontWeight: '500' },
  disabled: { opacity: 0.45 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 14,
  },
  card: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginTop: 7,
  },
  content: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  message: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  time: { fontSize: 13, fontWeight: '500', marginTop: 12 },
  pressed: { opacity: 0.8 },
});
