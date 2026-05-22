import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppIcon } from '@/components/AppIcon';
import { FormInput } from '@/components/FormField';
import { userWorkspaceService } from '@/services/userWorkspaceService';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import {
  DetailCard,
  DetailLoading,
  DetailNotFound,
  DetailRow,
  EntityDetailHeader,
} from '@/components/EntityDetailLayout';
import { refreshAfterTaskChange } from '@/utils/queryInvalidation';

const STATUSES = ['todo', 'in_progress', 'on_hold', 'completed'] as const;

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor } = useScreenColors();
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
    onSuccess: async () => {
      await refreshAfterTaskChange(queryClient);
      setStatusOpen(false);
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) => {
      Alert.alert('Update failed', e?.response?.data?.message || e?.message || 'Try again');
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => userWorkspaceService.addTaskComment(String(id), { text: comment.trim() }),
    onSuccess: async () => {
      await refreshAfterTaskChange(queryClient);
      setComment('');
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) => {
      Alert.alert('Comment failed', e?.response?.data?.message || e?.message || 'Try again');
    },
  });

  if (isLoading) return <DetailLoading title="Task" />;
  if (!task) return <DetailNotFound title="Task" entityLabel="Task" />;

  return (
    <>
      <EntityDetailHeader title={task.title || 'Task'} />
      <ScreenShell scrollable style={styles.container} contentContainerStyle={styles.content}>
        <DetailCard>
          <DetailRow label="Status">
            <Pressable onPress={() => setStatusOpen(true)} style={[styles.statusRow, { borderColor }]}>
              <Text style={[styles.statusText, { color: textColor }]}>
                {(task.status || 'todo').replace(/_/g, ' ')}
              </Text>
              <AppIcon name="chevron-down" size={14} color={mutedColor} />
            </Pressable>
          </DetailRow>
          {task.description ? (
            <DetailRow label="Description" value={task.description} />
          ) : null}
          {task.dueDate ? (
            <DetailRow label="Due date" value={String(task.dueDate).slice(0, 10)} />
          ) : null}
          {task.assignee?.name ? <DetailRow label="Assignee" value={task.assignee.name} /> : null}
        </DetailCard>

        <DetailCard>
          <Text style={[styles.commentsTitle, { color: textColor }]}>Comments</Text>
          {comments.length === 0 ? (
            <Text style={{ color: mutedColor }}>No comments yet.</Text>
          ) : (
            comments.map((c: { id?: string; text?: string; createdAt?: string }, idx: number) => (
              <View
                key={c.id || `c-${idx}`}
                style={[styles.commentRow, { borderTopColor: borderColor }]}
              >
                <Text style={{ color: textColor }}>{c.text}</Text>
                <Text style={{ color: mutedColor, fontSize: 12, marginTop: 4 }}>
                  {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                </Text>
              </View>
            ))
          )}
          <FormInput
            placeholder="Add a comment"
            value={comment}
            onChangeText={setComment}
            multiline
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
        </DetailCard>
      </ScreenShell>

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
                {(task.status || 'todo') === s ? <AppIcon name="check" size={18} color={colors.tint} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  commentsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  commentRow: { paddingVertical: 8, borderTopWidth: 1 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flex: 1,
  },
  statusText: { fontSize: 16, fontWeight: '600' },
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
