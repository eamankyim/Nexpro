import React, { useMemo, useState } from 'react';
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
  DetailHeroCard,
  DetailInfoRow,
  DetailLoading,
  DetailNotFound,
  DetailSectionCard,
  DetailFooter,
  DetailActionButton,
  DetailMoreActions,
  type DetailMoreAction,
  EntityDetailHeader,
} from '@/components/EntityDetailLayout';
import { useExclusiveAction } from '@/hooks/useExclusiveAction';
import { refreshAfterTaskChange } from '@/utils/queryInvalidation';

const STATUSES = ['todo', 'in_progress', 'on_hold', 'completed'] as const;
type TaskAction = 'status' | 'comment' | `status:${(typeof STATUSES)[number]}`;

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor } = useScreenColors();
  const queryClient = useQueryClient();
  const [statusOpen, setStatusOpen] = useState(false);
  const [comment, setComment] = useState('');
  const { isAnyActionActive, isActionActive, runExclusiveAction } = useExclusiveAction<TaskAction>();

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

  const taskStatus = task.status || 'todo';
  const taskIsCompleted = taskStatus === 'completed';
  const taskMoreActions: DetailMoreAction[] = taskIsCompleted
    ? STATUSES.filter((status) => status !== 'completed').map((status) => ({
        key: `status:${status}`,
        label: `Mark ${status.replace(/_/g, ' ')}`,
        onPress: () => runExclusiveAction(`status:${status}`, () => updateMutation.mutateAsync({ status })),
        loading: isActionActive(`status:${status}`),
        disabled: isAnyActionActive,
      }))
    : [
        {
          key: 'status',
          label: 'Update status',
          icon: 'refresh',
          onPress: () => setStatusOpen(true),
          disabled: isAnyActionActive,
        },
      ];

  return (
    <>
      <EntityDetailHeader title={task.title || 'Task'} />
      <ScreenShell style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
        <DetailHeroCard
          eyebrow="Task"
          title={(task.status || 'todo').replace(/_/g, ' ')}
          message={task.title || task.description || 'Workspace task details.'}
          metricLabel="Due Date"
          metricValue={task.dueDate ? String(task.dueDate).slice(0, 10) : 'No due date'}
          secondaryIcon="comments"
          secondaryLabel="Comments"
          secondaryValue={`${comments.length} ${comments.length === 1 ? 'Comment' : 'Comments'}`}
          showCheck={(task.status || 'todo') === 'completed'}
        />

        <DetailSectionCard title="Task Details" icon="sticky-note-o">
          <DetailInfoRow icon="tag" label="Status">
            <Pressable onPress={() => setStatusOpen(true)} style={[styles.statusRow, { borderColor }]}>
              <Text style={[styles.statusText, { color: textColor }]}>
                {(task.status || 'todo').replace(/_/g, ' ')}
              </Text>
              <AppIcon name="chevron-down" size={14} color={mutedColor} />
            </Pressable>
          </DetailInfoRow>
          {task.description ? (
            <DetailInfoRow icon="file-text" label="Description" value={task.description} />
          ) : null}
          {task.dueDate ? (
            <DetailInfoRow icon="calendar" label="Due date" value={String(task.dueDate).slice(0, 10)} />
          ) : null}
          {task.assignee?.name ? <DetailInfoRow icon="user" label="Assignee" value={task.assignee.name} /> : null}
        </DetailSectionCard>

        <DetailSectionCard title="Comments" icon="comments">
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
              runExclusiveAction('comment', () => commentMutation.mutateAsync());
            }}
            disabled={isAnyActionActive}
            style={[styles.sendBtn, { backgroundColor: colors.tint, opacity: isAnyActionActive ? 0.6 : 1 }]}
          >
            {isActionActive('comment') ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
            )}
          </Pressable>
        </DetailSectionCard>
        </ScrollView>
        <DetailFooter>
          {taskIsCompleted ? (
            <DetailActionButton
              label="Update status"
              icon="refresh"
              variant="primary"
              onPress={() => setStatusOpen(true)}
              disabled={isAnyActionActive}
            />
          ) : (
            <DetailActionButton
              label="Complete"
              icon="check"
              variant="primary"
              onPress={() => runExclusiveAction('status:completed', () => updateMutation.mutateAsync({ status: 'completed' }))}
              loading={isActionActive('status:completed')}
              disabled={isAnyActionActive}
            />
          )}
          {!taskIsCompleted ? (
            <DetailMoreActions actions={taskMoreActions} disabled={isAnyActionActive} />
          ) : taskMoreActions.length > 0 ? (
            <DetailMoreActions actions={taskMoreActions} disabled={isAnyActionActive} title="Change status" />
          ) : null}
        </DetailFooter>
      </ScreenShell>

      <Modal visible={statusOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => !isAnyActionActive && setStatusOpen(false)}>
          <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Set status</Text>
            {STATUSES.map((s) => {
              const actionKey: TaskAction = `status:${s}`;
              return (
                <Pressable
                  key={s}
                  onPress={() => runExclusiveAction(actionKey, () => updateMutation.mutateAsync({ status: s }))}
                  disabled={isAnyActionActive}
                  style={[styles.modalRow, { borderBottomColor: borderColor }]}
                >
                  <Text style={{ color: textColor, textTransform: 'capitalize', fontSize: 16 }}>
                    {s.replace(/_/g, ' ')}
                  </Text>
                  {isActionActive(actionKey) ? (
                    <ActivityIndicator size="small" color={colors.tint} />
                  ) : (task.status || 'todo') === s ? (
                    <AppIcon name="check" size={18} color={colors.tint} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, gap: 12 },
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
