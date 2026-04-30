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
  ScrollView,
  Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { userWorkspaceService } from '@/services/userWorkspaceService';
import { useAuth } from '@/context/AuthContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';

const STATUS_FILTERS = ['all', 'todo', 'in_progress', 'on_hold', 'completed'] as const;

type TaskRow = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  assignee?: { name?: string };
};

export default function TasksScreen() {
  const router = useRouter();
  const { user, activeTenantId, hasFeature } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['user-workspace', 'tasks', activeTenantId],
    queryFn: async () => userWorkspaceService.getTasks(),
    enabled: !!activeTenantId && hasFeature('jobAutomation') && user?.isPlatformAdmin !== true,
  });

  const tasks: TaskRow[] = useMemo(() => {
    const raw = data?.data;
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const filtered = useMemo(() => {
    if (status === 'all') return tasks;
    return tasks.filter((t) => (t.status || 'todo') === status);
  }, [tasks, status]);

  const createMutation = useMutation({
    mutationFn: () =>
      userWorkspaceService.createTask({
        title: title.trim(),
        description: description.trim() || '',
        status: 'todo',
        priority: 'medium',
        startDate: new Date().toISOString().slice(0, 10),
        dueDate: dueDate.trim() || null,
        isPrivate: false,
        assigneeId: user?.id || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'tasks'] });
      setAddOpen(false);
      setTitle('');
      setDescription('');
      setDueDate('');
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) => {
      Alert.alert('Could not create task', e?.response?.data?.message || e?.message || 'Try again');
    },
  });

  const onRefresh = useCallback(() => refetch(), [refetch]);

  if (user?.isPlatformAdmin === true) {
    return <FeatureAccessDenied message="Tasks are not available for platform admin accounts." />;
  }
  if (!hasFeature('jobAutomation')) {
    return <FeatureAccessDenied message="Tasks are not enabled for this workspace." />;
  }

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  const renderItem = ({ item }: { item: TaskRow }) => (
    <Pressable
      onPress={() => router.push(`/task/${item.id}` as never)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardBg, borderColor },
        pressed && { opacity: 0.88 },
      ]}
    >
      <View style={styles.rowTop}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
          {item.title || 'Untitled task'}
        </Text>
        <View style={[styles.badge, { borderColor: colors.tint }]}>
          <Text style={[styles.badgeText, { color: colors.tint }]}>{(item.status || 'todo').replace(/_/g, ' ')}</Text>
        </View>
      </View>
      {item.dueDate ? (
        <Text style={[styles.meta, { color: mutedColor }]}>Due {String(item.dueDate).slice(0, 10)}</Text>
      ) : null}
      {item.assignee?.name ? (
        <Text style={[styles.meta, { color: mutedColor }]}>{item.assignee.name}</Text>
      ) : null}
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.headerRow, { borderBottomColor: borderColor }]}>
        <Text style={[styles.screenTitle, { color: textColor }]}>Tasks</Text>
        <Pressable onPress={() => setAddOpen(true)} style={[styles.addBtn, { backgroundColor: colors.tint }]}>
          <FontAwesome name="plus" size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {STATUS_FILTERS.map((s) => {
          const active = status === s;
          const label = s === 'all' ? 'All' : s.replace(/_/g, ' ');
          return (
            <Pressable
              key={s}
              onPress={() => setStatus(s)}
              style={[
                styles.chip,
                { borderColor: active ? colors.tint : borderColor, backgroundColor: active ? `${colors.tint}22` : cardBg },
              ]}
            >
              <Text style={{ color: active ? colors.tint : textColor, fontWeight: '600', textTransform: 'capitalize' }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading && !data ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.tint} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={[styles.empty, { color: mutedColor }]}>No tasks in this filter.</Text>}
        />
      )}

      <Modal visible={addOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>New task</Text>
            <TextInput
              placeholder="Title *"
              placeholderTextColor={mutedColor}
              value={title}
              onChangeText={setTitle}
              style={[styles.input, { borderColor, color: textColor }]}
            />
            <TextInput
              placeholder="Description (optional)"
              placeholderTextColor={mutedColor}
              value={description}
              onChangeText={setDescription}
              multiline
              style={[styles.input, { borderColor, color: textColor, minHeight: 80 }]}
            />
            <TextInput
              placeholder="Due date YYYY-MM-DD (optional)"
              placeholderTextColor={mutedColor}
              value={dueDate}
              onChangeText={setDueDate}
              style={[styles.input, { borderColor, color: textColor }]}
            />
            <View style={styles.actions}>
              <Pressable onPress={() => setAddOpen(false)} style={[styles.secondaryBtn, { borderColor }]}>
                <Text style={{ color: textColor, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!title.trim()) {
                    Alert.alert('Title required');
                    return;
                  }
                  createMutation.mutate();
                }}
                style={[styles.primaryBtn, { backgroundColor: colors.tint }]}
              >
                {createMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Create</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  screenTitle: { fontSize: 22, fontWeight: '700' },
  addBtn: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chipsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  list: { padding: 12, paddingBottom: 32 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  title: { fontSize: 16, fontWeight: '600', flex: 1 },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  meta: { marginTop: 6, fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 32, fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 16,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1 },
  primaryBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, minWidth: 100, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontWeight: '700' },
});
