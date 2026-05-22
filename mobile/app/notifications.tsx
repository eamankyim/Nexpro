import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { AppIcon } from '@/components/AppIcon';
import { ListEmptyState } from '@/components/ListEmptyState';
import { StackPageHeader } from '@/components/StackPageHeader';
import { ListLoadingState, ListErrorState } from '@/components/ListScreenStates';
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
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const { activeTenantId } = useAuth();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor } = useScreenColors();
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

  const handleNotificationPress = useCallback(
    (item: Notification) => {
      if (!item.isRead) return markReadMutation.mutate(item.id);
    },
    [markReadMutation]
  );

  const renderItem = ({ item }: { item: Notification }) => (
    <Pressable
      onPress={() => handleNotificationPress(item)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardBg, borderColor },
        !item.isRead && [styles.unread, { borderLeftColor: colors.tint }],
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.tint + '20' }]}>
          <AppIcon name="bell" size={18} color={colors.tint} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {item.title}
          </Text>
          {item.message && (
            <Text style={[styles.message, { color: mutedColor }]} numberOfLines={2}>
              {item.message}
            </Text>
          )}
          <Text style={[styles.time, { color: mutedColor }]}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>
    </Pressable>
  );

  const hasUnread = notifications.some((n) => !n.isRead);
  const isEmpty = notifications.length === 0;

  return (
    <ScreenShell style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StackPageHeader
        title="Notifications"
        right={
          hasUnread ? (
            <Pressable
              onPress={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              style={styles.headerBtn}
            >
              <Text style={{ color: colors.tint, fontSize: 14, fontWeight: '600' }}>
                Mark all read
              </Text>
            </Pressable>
          ) : undefined
        }
      />
      {isLoading ? (
        <ListLoadingState message="Loading notifications..." />
      ) : isError ? (
        <ListErrorState
          title="Failed to load notifications"
          message={loadErrorMessage}
          onRetry={refetch}
        />
      ) : (
        <FlatList
          style={flatListStyleForEmpty}
          data={notifications}
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
  headerBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  unread: { borderLeftWidth: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  message: { fontSize: 14, marginTop: 4 },
  time: { fontSize: 12, marginTop: 6 },
  pressed: { opacity: 0.8 },
});
