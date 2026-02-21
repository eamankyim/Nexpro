import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { notificationService } from '@/services/notificationService';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BackButton } from '@/components/BackButton';

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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const { data: response, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications', activeTenantId],
    queryFn: () => notificationService.getNotifications({ page: 1, limit: 30 }),
    enabled: !!activeTenantId,
    staleTime: 60 * 1000,
    // Keep in cache for 30 minutes
    gcTime: 30 * 60 * 1000,
  });

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

  // Match web app pattern: response?.data || []
  const notifications: Notification[] = Array.isArray(response?.data) ? response.data : [];
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const handleNotificationPress = useCallback(
    (item: Notification) => {
      if (!item.isRead) return markReadMutation.mutate(item.id);
    },
    [markReadMutation]
  );

  const bg = colorScheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = colorScheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = colorScheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = colorScheme === 'dark' ? '#fff' : '#111';
  const mutedColor = colorScheme === 'dark' ? '#a1a1aa' : '#6b7280';

  const renderItem = ({ item }: { item: Notification }) => (
    <Pressable
      onPress={() => handleNotificationPress(item)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardBg, borderColor },
        !item.isRead && styles.unread,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.tint + '20' }]}>
          <FontAwesome name="bell" size={18} color={colors.tint} />
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

  const hasUnread = Array.isArray(notifications) && notifications.some((n) => !n.isRead);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      {/* Header with back button */}
      <View style={[styles.header, { backgroundColor: bg, paddingTop: insets.top > 0 ? insets.top : 12 }]}>
        <View style={styles.headerRow}>
          <BackButton />
          {hasUnread && (
            <Pressable
              onPress={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              style={styles.headerBtn}
            >
              <Text style={{ color: colors.tint, fontSize: 15, fontWeight: '600' }}>
                Mark all read
              </Text>
            </Pressable>
          )}
        </View>
      </View>
      {isLoading ? (
        <View style={[styles.center, { backgroundColor: bg }]}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={Array.isArray(notifications) ? notifications : []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="bell" size={48} color={colors.tabIconDefault} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No notifications</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                You're all caught up
              </Text>
            </View>
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  unread: { borderLeftWidth: 4, borderLeftColor: '#166534' },
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
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 8 },
});
