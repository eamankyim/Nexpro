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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import {
  DetailCard,
  DetailLoading,
  DetailNotFound,
  EntityDetailHeader,
} from '@/components/EntityDetailLayout';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { leadService } from '@/services/leadService';
import { getApiErrorMessage, parseApiEntity } from '@/utils/parseApiListResponse';
import { refreshAfterLeadChange } from '@/utils/queryInvalidation';
import { formatStatusLabel } from '@/utils/formatLabels';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

export default function LeadDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor } = useScreenColors();
  const queryClient = useQueryClient();
  const [statusOpen, setStatusOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadService.getById(String(id)),
    enabled: !!id,
  });

  const lead = useMemo(() => parseApiEntity<Record<string, any>>(data), [data]);

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => leadService.update(String(id), payload),
    onSuccess: async () => {
      await refreshAfterLeadChange(queryClient);
      setStatusOpen(false);
    },
    onError: (e: unknown) => {
      Alert.alert('Update failed', getApiErrorMessage(e, 'Try again'));
    },
  });

  const noteMutation = useMutation({
    mutationFn: () =>
      leadService.addActivity(String(id), {
        type: 'note',
        notes: noteText.trim(),
      }),
    onSuccess: async () => {
      await refreshAfterLeadChange(queryClient);
      setNoteOpen(false);
      setNoteText('');
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) => {
      Alert.alert('Could not save note', e?.response?.data?.message || e?.message || 'Try again');
    },
  });

  if (isLoading) return <DetailLoading title="Lead" />;
  if (!lead) return <DetailNotFound title="Lead" entityLabel="Lead" />;

  return (
    <>
      <EntityDetailHeader title={lead.name || 'Lead'} />
      <ScreenShell scrollable style={styles.container} contentContainerStyle={styles.content}>
        <DetailCard>
          <Text style={[styles.label, { color: mutedColor }]}>Status</Text>
          <Pressable onPress={() => setStatusOpen(true)} style={[styles.statusRow, { borderColor }]}>
            <Text style={[styles.statusText, { color: textColor }]}>
              {formatStatusLabel(lead.status || 'new')}
            </Text>
            <AppIcon name="chevron-down" size={14} color={mutedColor} />
          </Pressable>
          {lead.email ? (
            <>
              <Text style={[styles.label, { color: mutedColor, marginTop: 12 }]}>Email</Text>
              <Text style={{ color: textColor }}>{lead.email}</Text>
            </>
          ) : null}
          {lead.phone ? (
            <>
              <Text style={[styles.label, { color: mutedColor, marginTop: 12 }]}>Phone</Text>
              <Text style={{ color: textColor }}>{lead.phone}</Text>
            </>
          ) : null}
          {lead.company ? (
            <>
              <Text style={[styles.label, { color: mutedColor, marginTop: 12 }]}>Company</Text>
              <Text style={{ color: textColor }}>{lead.company}</Text>
            </>
          ) : null}
        </DetailCard>

        <Pressable
          onPress={() => setNoteOpen(true)}
          style={({ pressed }) => [
            styles.noteBtn,
            { backgroundColor: cardBg, borderColor, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <AppIcon name="sticky-note-o" size={18} color={colors.tint} />
          <Text style={[styles.noteBtnText, { color: colors.tint }]}>Add note</Text>
        </Pressable>

        {Array.isArray(lead.activities) && lead.activities.length > 0 ? (
          <DetailCard>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Activity</Text>
            {lead.activities.slice(0, 20).map((a: { id: string; type?: string; notes?: string; createdAt?: string }) => (
              <View key={a.id} style={[styles.activityRow, { borderTopColor: borderColor }]}>
                <Text style={[styles.activityMeta, { color: mutedColor }]}>
                  {(a.type || 'note').replace(/_/g, ' ')} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                </Text>
                {a.notes ? <Text style={{ color: textColor, marginTop: 4 }}>{a.notes}</Text> : null}
              </View>
            ))}
          </DetailCard>
        ) : null}
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
                <Text style={{ color: textColor, textTransform: 'capitalize', fontSize: 16 }}>{s}</Text>
                {(lead.status || 'new') === s ? <AppIcon name="check" size={18} color={colors.tint} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={noteOpen} animationType="slide" transparent>
        <View style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}>
          <View style={[styles.sheet, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Note</Text>
            <TextInput
              placeholder="Write a note"
              placeholderTextColor={mutedColor}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              style={[styles.noteInput, { borderColor, color: textColor }]}
            />
            <View style={styles.rowBtns}>
              <Pressable onPress={() => setNoteOpen(false)} style={[styles.secondaryBtn, { borderColor }]}>
                <Text style={{ color: textColor, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!noteText.trim()) {
                    Alert.alert('Note required', 'Enter a note or cancel.');
                    return;
                  }
                  noteMutation.mutate();
                }}
                style={[styles.primaryBtn, { backgroundColor: colors.tint }]}
              >
                {noteMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
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
  statusText: { fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
  noteBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  noteBtnText: { fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  activityRow: { paddingVertical: 12, borderTopWidth: 1 },
  activityMeta: { fontSize: 12 },
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
  sheet: {
    alignSelf: 'stretch',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 16,
    paddingBottom: 32,
  },
  noteInput: { borderWidth: 1, borderRadius: 10, minHeight: 100, padding: 12, textAlignVertical: 'top' },
  rowBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1 },
  primaryBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, minWidth: 100, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontWeight: '700' },
});
