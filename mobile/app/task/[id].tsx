import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { userWorkspaceService } from '@/services/userWorkspaceService';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';

const STATUSES = ['todo', 'in_progress', 'on_hold', 'completed'] as const;

export default function TaskDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const queryClient = useQueryClient();
  const [statusOpen, setStatusOpen] = useState(false);
  const [comment, setComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['user-workspace', 'task-detail', id],
    queryFn: () => userWorkspaceService.getTaskDetail(String(id)),
    enabled: !!id,
  });

  const { data: commentsData } = useQuery({
    queryKey: ['user-workspace', 'task-comments', id],
    queryFn: () => userWorkspaceService.getTaskComments(String(id)),
    enabled: !!id,
  });

  const task = useMemo(() => (data?.data ?? data) as Record<string, any> | null, [data]);
  const comments = useMemo(() => {
    const raw = commentsData?.data;
    return Array.isArray(raw) ? raw : [];
  }, [commentsData]);

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => userWorkspaceService.updateTask(String(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'task-detail', id] });
      setStatusOpen(false);
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) => {
      Alert.alert('Update failed', e?.response?.data?.message || e?.message || 'Try again');
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => userWorkspaceService.addTaskComment(String(id), { text: comment.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'task-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'tasks'] });
      setComment('');
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) => {
      Alert.alert('Comment failed', e?.response?.data?.message || e?.message || 'Try again');
    },
  });

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  const onBack = useCallback(() => router.back(), [router]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Task', headerShown: true }} />
        <View style={[styles.center, { backgroundColor: bg }]}>
          <ActivityIndicator color={colors.tint} />
        </View>
      </>
    );
  }

  if (!task) {
    return (
      <>
        <Stack.Screen options={{ title: 'Task', headerShown: true }} />
        <View style={[styles.center, { backgroundColor: bg }]}>
          <Text style={{ color: mutedColor }}>Task not found</Text>
          <Pressable onPress={onBack} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.tint, fontWeight: '600' }}>Go back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: task.title || 'Task',
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={onBack} hitSlop={12} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
              <FontAwesome name="chevron-left" size={18} color={colors.tint} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.label, { color: mutedColor }]}>Status</Text>
          <Pressable onPress={() => setStatusOpen(true)} style={[styles.statusRow, { borderColor }]}>
            <Text style={[styles.statusText, { color: textColor }]}>
              {(task.status || 'todo').replace(/_/g, ' ')}
            </Text>
            <FontAwesome name="chevron-down" size={14} color={mutedColor} />
          </Pressable>
          {task.description ? (
            <>
              <Text style={[styles.label, { color: mutedColor, marginTop: 12 }]}>Description</Text>
              <Text style={{ color: textColor }}>{task.description}</Text>
            </>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor, marginTop: 12 }]}>
          <Text style={[styles.label, { color: textColor, fontSize: 16, marginBottom: 8 }]}>Comments</Text>
          {comments.length === 0 ? (
            <Text style={{ color: mutedColor }}>No comments yet.</Text>
          ) : (
            comments.map((c: { id?: string; text?: string; createdAt?: string }, idx: number) => (
              <View key={c.id || `c-${idx}`} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: borderColor }}>
                <Text style={{ color: textColor }}>{c.text}</Text>
                <Text style={{ color: mutedColor, fontSize: 12, marginTop: 4 }}>
                  {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                </Text>
              </View>
            ))
          )}
          <TextInput
            placeholder="Add a comment"
            placeholderTextColor={mutedColor}
            value={comment}
            onChangeText={setComment}
            style={[styles.input, { borderColor, color: textColor, marginTop: 12 }]}
          />
          <Pressable
            onPress={() => {
              if (!comment.trim()) return;
              commentMutation.mutate();
            }}
            style={[styles.sendBtn, { backgroundColor: colors.tint }]}
          >
            {commentMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={statusOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setStatusOpen(false)}>
          <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Set status</Text>
            {STATUSES.map((s) => (
              <Pressable
                key={s}
                onPress={() => updateMutation.mutate({ status: s })}
                style={[styles.modalRow, { borderBottomColor: borderColor }]}
              >
                <Text style={{ color: textColor, textTransform: 'capitalize', fontSize: 16 }}>
                  {s.replace(/_/g, ' ')}
                </Text>
                {(task.status || 'todo') === s ? <FontAwesome name="check" color={colors.tint} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  statusText: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  sendBtn: { marginTop: 10, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 12, borderWidth: 1, padding: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', padding: 12 },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
});
