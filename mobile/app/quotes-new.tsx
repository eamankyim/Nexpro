import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { isQuotesEnabledForTenant } from '@/constants';
import { customerService } from '@/services/customerService';
import { quoteService } from '@/services/quoteService';

const PRIMARY = '#166534';

type QuoteItemForm = {
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
};

export default function NewQuoteScreen() {
  const router = useRouter();
  const { activeTenant, activeTenantId, hasFeature } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const queryClient = useQueryClient();

  const businessType = activeTenant?.businessType ?? 'printing_press';
  const shopType = activeTenant?.metadata?.shopType;
  const quotesFeatureOk =
    hasFeature('quoteAutomation') && isQuotesEnabledForTenant(businessType, shopType);

  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<QuoteItemForm[]>([
    { description: '', quantity: '1', unitPrice: '0', discountAmount: '0' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const {
    data: customersResponse,
    isLoading: loadingCustomers,
  } = useQuery({
    queryKey: ['customers', 'quotes-new', activeTenantId],
    queryFn: () => customerService.getCustomers({ limit: 100 }),
    enabled: !!activeTenantId && quotesFeatureOk && hasFeature('crm'),
    staleTime: 5 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  const customers: { id: string; name: string }[] =
    (customersResponse?.data as any[]) ??
    (Array.isArray(customersResponse) ? (customersResponse as any[]) : []);

  const createQuoteMutation = useMutation({
    mutationFn: (payload: any) => quoteService.createQuote(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      Alert.alert('Success', 'Quote created successfully.');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert(
        'Error',
        err?.response?.data?.message || 'Failed to create quote. Please try again.'
      );
    },
  });

  const handleAddItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { description: '', quantity: '1', unitPrice: '0', discountAmount: '0' },
    ]);
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleItemChange = useCallback(
    (index: number, field: keyof QuoteItemForm, value: string) => {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...item,
                [field]: value,
              }
            : item
        )
      );
    },
    []
  );

  const handleSubmit = useCallback(() => {
    if (!quotesFeatureOk) {
      Alert.alert('Not supported', 'Quotes are not available for this workspace.');
      return;
    }
    if (!customerId) {
      Alert.alert('Missing customer', 'Please select a customer for this quote.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a quote title.');
      return;
    }

    const normalizedItems = items
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        discountAmount: Number(item.discountAmount || 0),
      }))
      .filter((item) => item.description && item.quantity > 0);

    if (normalizedItems.length === 0) {
      Alert.alert('Missing items', 'Add at least one item with description and quantity.');
      return;
    }

    const payload: any = {
      customerId,
      title: title.trim(),
      description: description.trim() || undefined,
      status: 'draft',
      notes: notes.trim() || undefined,
      items: normalizedItems,
    };

    if (validUntil.trim()) {
      payload.validUntil = validUntil.trim();
    }

    setSubmitting(true);
    createQuoteMutation.mutate(payload, {
      onSettled: () => setSubmitting(false),
    });
  }, [customerId, title, description, notes, validUntil, items, quotesFeatureOk, createQuoteMutation]);

  if (!quotesFeatureOk) {
    return (
      <FeatureAccessDenied message="Quotes are not enabled for this workspace or business type." />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.logo}>ABS</Text>
        <Text style={styles.title}>New quote</Text>
        <Text style={styles.subtitle}>
          Create a detailed quote with items and send it to your customer.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.background, borderColor: '#e5e7eb' }]}>
          <Text style={styles.sectionLabel}>Customer *</Text>
          {loadingCustomers ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={PRIMARY} />
              <Text style={styles.loadingHint}>Loading customers…</Text>
            </View>
          ) : customers.length > 0 ? (
            <View style={styles.customerChipsRow}>
              {customers.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCustomerId(c.id)}
                  style={[
                    styles.customerChip,
                    customerId === c.id && styles.customerChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.customerChipText,
                      customerId === c.id && styles.customerChipTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>
              No customers found. Add customers first from the Customers tab.
            </Text>
          )}

          <Text style={styles.sectionLabel}>Quote title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Branding and printing for ACME Co."
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.sectionLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Short note about this quote"
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Text style={styles.sectionLabel}>Valid until (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9ca3af"
            value={validUntil}
            onChangeText={setValidUntil}
          />

          <Text style={styles.sectionLabel}>Items</Text>
          {items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeaderRow}>
                <Text style={styles.itemTitle}>Item {index + 1}</Text>
                {items.length > 1 && (
                  <Pressable onPress={() => handleRemoveItem(index)} hitSlop={8}>
                    <FontAwesome name="trash" size={16} color="#dc2626" />
                  </Pressable>
                )}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Item description"
                placeholderTextColor="#9ca3af"
                value={item.description}
                onChangeText={(text) => handleItemChange(index, 'description', text)}
              />
              <View style={styles.itemRow}>
                <View style={styles.itemField}>
                  <Text style={styles.itemLabel}>Qty</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={item.quantity}
                    onChangeText={(text) => handleItemChange(index, 'quantity', text)}
                  />
                </View>
                <View style={styles.itemField}>
                  <Text style={styles.itemLabel}>Unit price</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={item.unitPrice}
                    onChangeText={(text) => handleItemChange(index, 'unitPrice', text)}
                  />
                </View>
              </View>
              <View style={styles.itemRow}>
                <View style={styles.itemField}>
                  <Text style={styles.itemLabel}>Discount (amount)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={item.discountAmount}
                    onChangeText={(text) => handleItemChange(index, 'discountAmount', text)}
                  />
                </View>
              </View>
            </View>
          ))}

          <Pressable style={styles.addItemButton} onPress={handleAddItem}>
            <FontAwesome name="plus" size={14} color={PRIMARY} />
            <Text style={styles.addItemButtonText}>Add item</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any extra notes for this quote"
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Pressable
            style={[
              styles.primaryButton,
              (submitting || createQuoteMutation.isPending) && styles.primaryButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || createQuoteMutation.isPending}
          >
            {submitting || createQuoteMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Create quote</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 32 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  centerTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 8 },
  centerSubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  logo: { fontSize: 24, fontWeight: '700', color: PRIMARY, marginBottom: 8, textAlign: 'left' },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  loadingHint: { fontSize: 14, color: '#6b7280' },
  customerChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  customerChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  customerChipSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  customerChipText: { fontSize: 13, color: '#374151' },
  customerChipTextSelected: { color: '#fff' },
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  itemCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: { fontSize: 13, fontWeight: '600', color: '#111' },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
  },
  itemField: { flex: 1 },
  itemLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  addItemButtonText: { fontSize: 14, fontWeight: '600', color: PRIMARY },
  primaryButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

