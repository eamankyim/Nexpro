import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FormSheetModal } from '@/components/FormSheetModal';
import {
  DetailCard,
  DetailFooter,
  DetailLoading,
  DetailNotFound,
  DetailRow,
  DetailActionButton,
  EntityDetailHeader,
  useEntityDetailTheme,
} from '@/components/EntityDetailLayout';
import { ScreenShell } from '@/components/ScreenShell';
import { FORM_LABELS } from '@/constants/formLabels';
import { customerService, type CustomerPayload } from '@/services/customerService';
import { customDropdownService } from '@/services/customDropdownService';
import { settingsService } from '@/services/settings';
import { getApiErrorMessage, parseApiEntity } from '@/utils/parseApiListResponse';
import { refreshAfterCustomerChange } from '@/utils/queryInvalidation';

type CustomerDetail = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  howDidYouHear?: string;
  referralName?: string;
  balance?: number | string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const FALLBACK_CUSTOMER_SOURCES = [
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Website', label: 'Website' },
  { value: 'Social Media', label: 'Social Media' },
];

const OTHER_SOURCE_VALUE = '__OTHER__';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { cardBg, borderColor, textColor, mutedColor, bg, colors } = useEntityDetailTheme();
  const [editOpen, setEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    howDidYouHear: '',
    referralName: '',
  });
  const [customSourceValue, setCustomSourceValue] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerService.getCustomerById(String(id)),
    enabled: !!id,
  });

  const customer = useMemo(() => parseApiEntity<CustomerDetail>(data), [data]);

  const { data: customerSourceOptions = [] } = useQuery({
    queryKey: ['settings', 'customer-sources'],
    queryFn: () => settingsService.getCustomerSources(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: customSourceOptions = [] } = useQuery({
    queryKey: ['custom-dropdowns', 'customer_source'],
    queryFn: () => customDropdownService.getCustomOptions('customer_source'),
    staleTime: 5 * 60 * 1000,
  });

  const sourceOptions = useMemo(() => {
    const apiOptions = Array.isArray(customerSourceOptions) ? customerSourceOptions : [];
    const mappedApi = apiOptions.map((source: { value: string; label?: string }) => ({
      value: source.value,
      label: source.label || source.value,
    }));
    const base = mappedApi.length > 0 ? mappedApi : FALLBACK_CUSTOMER_SOURCES;
    const custom = Array.isArray(customSourceOptions)
      ? customSourceOptions.map((source) => ({ value: source.value, label: source.label || source.value }))
      : [];
    const merged = new Map<string, { value: string; label: string }>();
    [...base, ...custom].forEach((source) => {
      if (source.value) merged.set(source.value, source);
    });
    return Array.from(merged.values());
  }, [customerSourceOptions, customSourceOptions]);

  const openEdit = useCallback(() => {
    if (!customer) return;
    setFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      company: customer.company || '',
      address: customer.address || '',
      howDidYouHear: customer.howDidYouHear || '',
      referralName: customer.referralName || '',
    });
    setCustomSourceValue('');
    setEditOpen(true);
  }, [customer]);

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<CustomerPayload>) => customerService.updateCustomer(String(id), payload),
    onSuccess: async () => {
      await refreshAfterCustomerChange(queryClient);
      setEditOpen(false);
      Alert.alert('Success', 'Customer updated');
    },
    onError: (err: unknown) => {
      Alert.alert('Error', getApiErrorMessage(err, 'Failed to update customer'));
    },
  });

  const resolveSourceValue = useCallback(async () => {
    if (formData.howDidYouHear !== OTHER_SOURCE_VALUE) return formData.howDidYouHear;
    const value = customSourceValue.trim();
    if (!value) {
      Alert.alert('Error', 'Please enter how the customer heard about you');
      return null;
    }
    const saved = await customDropdownService.saveCustomOption('customer_source', value, value);
    queryClient.invalidateQueries({ queryKey: ['custom-dropdowns', 'customer_source'] });
    return saved?.value || value;
  }, [customSourceValue, formData.howDidYouHear, queryClient]);

  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    try {
      const sourceValue = await resolveSourceValue();
      if (sourceValue === null) return;
      updateMutation.mutate({
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        company: formData.company.trim() || undefined,
        address: formData.address.trim() || undefined,
        howDidYouHear: sourceValue || undefined,
        referralName: sourceValue === 'Referral' ? formData.referralName.trim() || undefined : undefined,
      });
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'Failed to save customer source'));
    }
  }, [formData, resolveSourceValue, updateMutation]);

  if (isLoading) return <DetailLoading title="Customer" />;
  if (!customer) return <DetailNotFound title="Customer" entityLabel="Customer" />;

  return (
    <>
      <EntityDetailHeader title={customer.name || 'Customer'} />
      <ScreenShell style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <DetailCard>
            <DetailRow label={FORM_LABELS.customer.name} value={customer.name} />
            <DetailRow label={FORM_LABELS.customer.company.replace(' (optional)', '')} value={customer.company || '—'} />
            <DetailRow label={FORM_LABELS.customer.email.replace(' (optional)', '')} value={customer.email || '—'} />
            <DetailRow label={FORM_LABELS.customer.phone.replace(' (optional)', '')} value={customer.phone || '—'} />
            <DetailRow label="Address" value={customer.address || '—'} />
            <DetailRow label="Source" value={customer.howDidYouHear || '—'} />
            {customer.howDidYouHear === 'Referral' ? (
              <DetailRow label="Referral Name" value={customer.referralName || '—'} />
            ) : null}
          </DetailCard>
        </ScrollView>
        <DetailFooter>
          <DetailActionButton label="Edit customer" icon="edit" variant="primary" onPress={openEdit} />
        </DetailFooter>
      </ScreenShell>

      <FormSheetModal
        visible={editOpen}
        title={FORM_LABELS.customer.editTitle}
        onClose={() => setEditOpen(false)}
        cardBg={cardBg}
        borderColor={borderColor}
        textColor={textColor}
        mutedColor={mutedColor}
        footer={
          <Pressable
            onPress={handleSave}
            disabled={updateMutation.isPending}
            style={[styles.saveBtn, { backgroundColor: colors.tint }]}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>{FORM_LABELS.customer.save}</Text>
            )}
          </Pressable>
        }
      >
        <Text style={[styles.label, { color: textColor }]}>{FORM_LABELS.customer.name}</Text>
        <TextInput
          style={[styles.input, { color: textColor, borderColor }]}
          value={formData.name}
          onChangeText={(t) => setFormData((p) => ({ ...p, name: t }))}
        />
        <Text style={[styles.label, { color: textColor }]}>{FORM_LABELS.customer.company}</Text>
        <TextInput
          style={[styles.input, { color: textColor, borderColor }]}
          value={formData.company}
          onChangeText={(t) => setFormData((p) => ({ ...p, company: t }))}
        />
        <Text style={[styles.label, { color: textColor }]}>{FORM_LABELS.customer.email}</Text>
        <TextInput
          style={[styles.input, { color: textColor, borderColor }]}
          value={formData.email}
          onChangeText={(t) => setFormData((p) => ({ ...p, email: t }))}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={[styles.label, { color: textColor }]}>{FORM_LABELS.customer.phone}</Text>
        <TextInput
          style={[styles.input, { color: textColor, borderColor }]}
          value={formData.phone}
          onChangeText={(t) => setFormData((p) => ({ ...p, phone: t }))}
          keyboardType="phone-pad"
        />
        <Text style={[styles.label, { color: textColor }]}>Address (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea, { color: textColor, borderColor }]}
          value={formData.address}
          onChangeText={(t) => setFormData((p) => ({ ...p, address: t }))}
          placeholder="Enter street address"
          placeholderTextColor={mutedColor}
          multiline
        />
        <Text style={[styles.label, { color: textColor }]}>How did you hear about us? (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourceScroll}>
          {[...sourceOptions, { value: OTHER_SOURCE_VALUE, label: 'Other (specify)' }].map((source) => {
            const selected = formData.howDidYouHear === source.value;
            return (
              <Pressable
                key={source.value}
                onPress={() =>
                  setFormData((p) => ({
                    ...p,
                    howDidYouHear: source.value,
                    referralName: source.value === 'Referral' ? p.referralName : '',
                  }))
                }
                style={[
                  styles.sourceChip,
                  { borderColor, backgroundColor: selected ? colors.tint : 'transparent' },
                ]}
              >
                <Text style={[styles.sourceChipText, { color: selected ? '#fff' : textColor }]}>
                  {source.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {formData.howDidYouHear === OTHER_SOURCE_VALUE ? (
          <>
            <Text style={[styles.label, { color: textColor }]}>Other source (optional)</Text>
            <TextInput
              style={[styles.input, { color: textColor, borderColor }]}
              value={customSourceValue}
              onChangeText={setCustomSourceValue}
              placeholder="e.g., Billboard, Magazine Ad"
              placeholderTextColor={mutedColor}
            />
          </>
        ) : null}
        {formData.howDidYouHear === 'Referral' ? (
          <>
            <Text style={[styles.label, { color: textColor }]}>Referral Name (optional)</Text>
            <TextInput
              style={[styles.input, { color: textColor, borderColor }]}
              value={formData.referralName}
              onChangeText={(t) => setFormData((p) => ({ ...p, referralName: t }))}
              placeholder="Enter referral name"
              placeholderTextColor={mutedColor}
            />
          </>
        ) : null}
      </FormSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16 },
  saveBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 8 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  sourceScroll: { marginTop: 4, marginBottom: 8 },
  sourceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  sourceChipText: { fontSize: 14, fontWeight: '500' },
});
