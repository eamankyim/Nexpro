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

import { leadService } from '@/services/leadService';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

export default function LeadDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const queryClient = useQueryClient();
  const [statusOpen, setStatusOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadService.getById(String(id)),
    enabled: !!id,
  });

  const lead = useMemo(() => (data?.data ?? data) as Record<string, any> | null, [data]);

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => leadService.update(String(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setStatusOpen(false);
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) => {
      Alert.alert('Update failed', e?.response?.data?.message || e?.message || 'Try again');
    },
  });

  const noteMutation = useMutation({
    mutationFn: () =>
      leadService.addActivity(String(id), {
        type: 'note',
        notes: noteText.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      setNoteOpen(false);
      setNoteText('');
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) => {
      Alert.alert('Could not save note', e?.response?.data?.message || e?.message || 'Try again');
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
        <Stack.Screen options={{ title: 'Lead', headerShown: true }} />
        <View style={[styles.center, { backgroundColor: bg }]}>
          <ActivityIndicator color={colors.tint} />
        </View>
      </>
    );
  }

  if (!lead) {
    return (
      <>
        <Stack.Screen options={{ title: 'Lead', headerShown: true }} />
        <View style={[styles.center, { backgroundColor: bg }]}>
          <Text style={{ color: mutedColor }}>Lead not found</Text>
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
          title: lead.name || 'Lead',
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
            <Text style={[styles.statusText, { color: textColor }]}>{lead.status || 'new'}</Text>
            <FontAwesome name="chevron-down" size={14} color={mutedColor} />
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
        </View>

        <Pressable
          onPress={() => setNoteOpen(true)}
          style={({ pressed }) => [
            styles.noteBtn,
            { backgroundColor: cardBg, borderColor, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <FontAwesome name="sticky-note-o" size={18} color={colors.tint} />
          <Text style={[styles.noteBtnText, { color: colors.tint }]}>Add note</Text>
        </Pressable>

        {Array.isArray(lead.activities) && lead.activities.length > 0 ? (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor, marginTop: 12 }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Activity</Text>
            {lead.activities.slice(0, 20).map((a: { id: string; type?: string; notes?: string; createdAt?: string }) => (
              <View key={a.id} style={[styles.activityRow, { borderTopColor: borderColor }]}>
                <Text style={[styles.activityMeta, { color: mutedColor }]}>
                  {(a.type || 'note').replace(/_/g, ' ')} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                </Text>
                {a.notes ? <Text style={{ color: textColor, marginTop: 4 }}>{a.notes}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
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
                <Text style={{ color: textColor, textTransform: 'capitalize', fontSize: 16 }}>{s}</Text>
                {(lead.status || 'new') === s ? <FontAwesome name="check" color={colors.tint} /> : null}
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
