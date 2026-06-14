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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppIcon } from '@/components/AppIcon';
import {
  DetailHeroCard,
  DetailInfoRow,
  DetailSectionCard,
  DetailFooter,
  DetailLoading,
  DetailNotFound,
  DetailActionButton,
  DetailMoreActions,
  type DetailMoreAction,
  EntityDetailHeader,
} from '@/components/EntityDetailLayout';
import { useExclusiveAction } from '@/hooks/useExclusiveAction';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { leadService } from '@/services/leadService';
import { getApiErrorMessage, parseApiEntity } from '@/utils/parseApiListResponse';
import { refreshAfterLeadChange } from '@/utils/queryInvalidation';
import { formatStatusLabel } from '@/utils/formatLabels';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
type LeadAction = 'note' | 'convert' | `status:${(typeof STATUSES)[number]}`;

export default function LeadDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor } = useScreenColors();
  const queryClient = useQueryClient();
  const [statusOpen, setStatusOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const { isAnyActionActive, isActionActive, runExclusiveAction } = useExclusiveAction<LeadAction>();

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

  const handleStatusUpdate = useCallback(
    (status: (typeof STATUSES)[number]) => {
      runExclusiveAction(`status:${status}`, () => updateMutation.mutateAsync({ status }));
    },
    [runExclusiveAction, updateMutation]
  );

  const handleConvertToCustomer = useCallback(async () => {
    if (!lead) return;
    await runExclusiveAction('convert', async () => {
      try {
        const res = await leadService.convertToCustomer(String(id));
        await refreshAfterLeadChange(queryClient);
        const payload = res?.data ?? res;
        const customerId =
          (payload as { customer?: { id?: string } })?.customer?.id ??
          (payload as { convertedCustomer?: { id?: string } })?.convertedCustomer?.id ??
          (payload as { convertedCustomerId?: string })?.convertedCustomerId;
        Alert.alert('Success', 'Lead converted to customer');
        if (customerId) {
          router.push(`/customer/${encodeURIComponent(customerId)}` as any);
        } else {
          await refetch();
        }
      } catch (err: unknown) {
        Alert.alert('Conversion failed', getApiErrorMessage(err, 'Could not convert lead to customer'));
      }
    });
  }, [id, lead, queryClient, refetch, router, runExclusiveAction]);

  if (isLoading) return <DetailLoading title="Lead" />;
  if (!lead) return <DetailNotFound title="Lead" entityLabel="Lead" />;

  const leadStatus = lead.status || 'new';
  const leadIsConverted = leadStatus === 'converted';
  const leadMoreActions: DetailMoreAction[] = [
    ...(!leadIsConverted
      ? [{
          key: 'status',
          label: 'Update status',
          icon: 'refresh' as const,
          onPress: () => setStatusOpen(true),
          disabled: isAnyActionActive,
        }]
      : []),
    {
      key: 'note',
      label: 'Add note',
      icon: 'sticky-note-o',
      onPress: () => setNoteOpen(true),
      disabled: isAnyActionActive,
    },
  ];

  return (
    <>
      <EntityDetailHeader title={lead.name || 'Lead'} />
      <ScreenShell style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <DetailHeroCard
            eyebrow="Lead"
            title={formatStatusLabel(lead.status || 'new')}
            message={lead.name || lead.company || 'Lead details and activity.'}
            metricLabel="Contact"
            metricValue={lead.phone || lead.email || 'No contact'}
            secondaryIcon="sticky-note-o"
            secondaryLabel="Activity"
            secondaryValue={`${Array.isArray(lead.activities) ? lead.activities.length : 0} ${(Array.isArray(lead.activities) && lead.activities.length === 1) ? 'Entry' : 'Entries'}`}
            showCheck={(lead.status || 'new') === 'converted'}
          />

        <DetailSectionCard title="Lead Details" icon="user-plus">
          <Text style={[styles.label, { color: mutedColor }]}>Status</Text>
          <Pressable
            onPress={() => setStatusOpen(true)}
            disabled={isAnyActionActive}
            style={[styles.statusRow, { borderColor }, isAnyActionActive && styles.disabledAction]}
          >
            <Text style={[styles.statusText, { color: textColor }]}>
              {formatStatusLabel(lead.status || 'new')}
            </Text>
            <AppIcon name="chevron-down" size={14} color={mutedColor} />
          </Pressable>
          {lead.email ? (
            <DetailInfoRow icon="mail" label="Email" value={lead.email} />
          ) : null}
          {lead.phone ? (
            <DetailInfoRow icon="phone" label="Phone" value={lead.phone} />
          ) : null}
          {lead.company ? (
            <DetailInfoRow icon="briefcase" label="Company" value={lead.company} />
          ) : null}
          {lead.metadata?.serviceTitle ? (
            <DetailInfoRow icon="briefcase" label="Service requested" value={String(lead.metadata.serviceTitle)} />
          ) : null}
          {lead.metadata?.requestMessage ? (
            <DetailInfoRow icon="sticky-note-o" label="Request message" value={String(lead.metadata.requestMessage)} />
          ) : null}
        </DetailSectionCard>

        <Pressable
          onPress={() => setNoteOpen(true)}
          disabled={isAnyActionActive}
          style={({ pressed }) => [
            styles.noteBtn,
            { backgroundColor: cardBg, borderColor, opacity: pressed ? 0.85 : isAnyActionActive ? 0.6 : 1 },
          ]}
        >
          <AppIcon name="sticky-note-o" size={18} color={colors.tint} />
          <Text style={[styles.noteBtnText, { color: colors.tint }]}>Add note</Text>
        </Pressable>

        {Array.isArray(lead.activities) && lead.activities.length > 0 ? (
          <DetailSectionCard title="Activity" icon="sticky-note-o">
            {lead.activities.slice(0, 20).map((a: { id: string; type?: string; notes?: string; createdAt?: string }) => (
              <View key={a.id} style={[styles.activityRow, { borderTopColor: borderColor }]}>
                <Text style={[styles.activityMeta, { color: mutedColor }]}>
                  {(a.type || 'note').replace(/_/g, ' ')} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                </Text>
                {a.notes ? <Text style={{ color: textColor, marginTop: 4 }}>{a.notes}</Text> : null}
              </View>
            ))}
          </DetailSectionCard>
        ) : null}
        </ScrollView>
        <DetailFooter>
          {leadIsConverted ? (
            <DetailActionButton
              label="Update status"
              icon="refresh"
              variant="primary"
              onPress={() => setStatusOpen(true)}
              disabled={isAnyActionActive}
            />
          ) : (
            <DetailActionButton
              label="Convert to customer"
              variant="primary"
              onPress={handleConvertToCustomer}
              loading={isActionActive('convert')}
              disabled={isAnyActionActive}
            />
          )}
          <DetailMoreActions actions={leadMoreActions} disabled={isAnyActionActive} />
        </DetailFooter>
      </ScreenShell>

      <Modal visible={statusOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => !isAnyActionActive && setStatusOpen(false)}>
          <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Set status</Text>
            {STATUSES.map((s) => {
              const actionKey: LeadAction = `status:${s}`;
              return (
                <Pressable
                  key={s}
                  onPress={() => handleStatusUpdate(s)}
                  disabled={isAnyActionActive}
                  style={[styles.modalRow, { borderBottomColor: borderColor }]}
                >
                  <Text style={{ color: textColor, textTransform: 'capitalize', fontSize: 16 }}>{s}</Text>
                  {isActionActive(actionKey) ? (
                    <ActivityIndicator size="small" color={colors.tint} />
                  ) : (lead.status || 'new') === s ? (
                    <AppIcon name="check" size={18} color={colors.tint} />
                  ) : null}
                </Pressable>
              );
            })}
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
              <Pressable
                onPress={() => setNoteOpen(false)}
                disabled={isAnyActionActive}
                style={[styles.secondaryBtn, { borderColor }]}
              >
                <Text style={{ color: textColor, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!noteText.trim()) {
                    Alert.alert('Note required', 'Enter a note or cancel.');
                    return;
                  }
                  runExclusiveAction('note', () => noteMutation.mutateAsync());
                }}
                disabled={isAnyActionActive}
                style={[styles.primaryBtn, { backgroundColor: colors.tint }]}
              >
                {isActionActive('note') ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Save</Text>}
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
  disabledAction: { opacity: 0.6 },
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
