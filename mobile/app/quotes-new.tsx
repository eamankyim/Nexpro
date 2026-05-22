import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { useAuth } from '@/context/AuthContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { StackPageHeader } from '@/components/StackPageHeader';
import { FormInput, FormLabel } from '@/components/FormField';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { CURRENCY, isQuotesEnabledForTenant, resolveBusinessType } from '@/constants';
import { formatCurrency } from '@/utils/formatCurrency';
import { customerService } from '@/services/customerService';
import { productService } from '@/services/productService';
import { quoteService } from '@/services/quoteService';
import { parseApiListResponse } from '@/utils/parseApiListResponse';
import { refreshAfterQuoteChange } from '@/utils/queryInvalidation';

type QuoteItemForm = {
  productId?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
};

type ProductOption = {
  id: string;
  name: string;
  sku?: string | null;
  sellingPrice?: number | string | null;
  quantityOnHand?: number | string | null;
  trackStock?: boolean;
};

export default function NewQuoteScreen() {
  const router = useRouter();
  const { activeTenant, activeTenantId, hasFeature } = useAuth();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor, inputBg } = useScreenColors();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const businessType = activeTenant?.businessType ?? 'printing_press';
  const shopType = activeTenant?.metadata?.shopType;
  const resolvedBusinessType = resolveBusinessType(businessType);
  const isRetailLike = resolvedBusinessType === 'shop' || resolvedBusinessType === 'pharmacy';
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

  const {
    data: productsResponse,
    isLoading: loadingProducts,
  } = useQuery({
    queryKey: ['products', 'quotes-new', activeTenantId],
    queryFn: () => productService.getProducts({ limit: 100, isActive: true }),
    enabled: !!activeTenantId && quotesFeatureOk && isRetailLike && hasFeature('products'),
    staleTime: 5 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  const products = useMemo(
    () => parseApiListResponse<ProductOption>(productsResponse),
    [productsResponse]
  );

  const createQuoteMutation = useMutation({
    mutationFn: (payload: any) => quoteService.createQuote(payload),
    onSuccess: async () => {
      await refreshAfterQuoteChange(queryClient);
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

  const handleProductSelect = useCallback((index: number, product: ProductOption) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              productId: product.id,
              description: product.name,
              unitPrice: String(product.sellingPrice ?? 0),
            }
          : item
      )
    );
  }, []);

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
        productId: item.productId,
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
    <ScreenShell style={styles.container}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <StackPageHeader
        title="New quote"
        subtitle="Add items and send to your customer."
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <FormLabel>Customer</FormLabel>
          {loadingCustomers ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.tint} />
              <Text style={[styles.loadingHint, { color: mutedColor }]}>Loading customers…</Text>
            </View>
          ) : customers.length > 0 ? (
            <View style={styles.customerChipsRow}>
              {customers.map((c) => {
                const selected = customerId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCustomerId(c.id)}
                    style={[
                      styles.customerChip,
                      { borderColor },
                      selected && { backgroundColor: colors.tint, borderColor: colors.tint },
                    ]}
                  >
                    <Text
                      style={[styles.customerChipText, { color: selected ? '#fff' : textColor }]}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.hint, { color: mutedColor }]}>
              No customers found. Add customers first from the Customers tab.
            </Text>
          )}

          <FormLabel>Quote title</FormLabel>
          <FormInput
            placeholder="e.g. Branding and printing for ACME Co."
            value={title}
            onChangeText={setTitle}
          />

          <FormLabel optional>Description</FormLabel>
          <FormInput
            placeholder="Short note about this quote"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <FormLabel optional>Valid until</FormLabel>
          <FormInput
            placeholder="YYYY-MM-DD"
            value={validUntil}
            onChangeText={setValidUntil}
          />

          <FormLabel>Items</FormLabel>
          {items.map((item, index) => (
            <View key={index} style={[styles.itemCard, { borderColor, backgroundColor: inputBg }]}>
              <View style={styles.itemHeaderRow}>
                <Text style={[styles.itemTitle, { color: textColor }]}>Item {index + 1}</Text>
                {items.length > 1 && (
                  <Pressable onPress={() => handleRemoveItem(index)} hitSlop={8}>
                    <AppIcon name="trash" size={16} color="#dc2626" />
                  </Pressable>
                )}
              </View>
              {isRetailLike && (
                <View style={styles.productPickerBlock}>
                  <FormLabel optional>Pick from products</FormLabel>
                  {loadingProducts ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color={colors.tint} />
                      <Text style={[styles.loadingHint, { color: mutedColor }]}>Loading products...</Text>
                    </View>
                  ) : products.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.productChipsRow}
                    >
                      {products.map((product) => {
                        const selected = item.productId === product.id;
                        const stockValue = Number(product.quantityOnHand ?? 0);
                        const showStock = product.trackStock !== false;

                        return (
                          <Pressable
                            key={product.id}
                            onPress={() => handleProductSelect(index, product)}
                            style={[
                              styles.productChip,
                              { borderColor },
                              selected && { backgroundColor: colors.tint, borderColor: colors.tint },
                            ]}
                          >
                            <Text
                              style={[styles.productChipName, { color: selected ? '#fff' : textColor }]}
                              numberOfLines={1}
                            >
                              {product.name}
                            </Text>
                            <Text
                              style={[styles.productChipMeta, { color: selected ? '#ecfdf5' : mutedColor }]}
                              numberOfLines={1}
                            >
                              {formatCurrency(product.sellingPrice)}
                              {showStock ? ` · Stock ${stockValue}` : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <Text style={[styles.hint, { color: mutedColor }]}>
                      No products found. You can still type the item manually.
                    </Text>
                  )}
                </View>
              )}
              <FormInput
                placeholder="Item description"
                value={item.description}
                onChangeText={(text) => handleItemChange(index, 'description', text)}
              />
              <View style={styles.itemRow}>
                <View style={styles.itemField}>
                  <FormLabel>Qty</FormLabel>
                  <FormInput
                    placeholder="1"
                    keyboardType="numeric"
                    value={item.quantity}
                    onChangeText={(text) => handleItemChange(index, 'quantity', text)}
                  />
                </View>
                <View style={styles.itemField}>
                  <FormLabel>Unit price</FormLabel>
                  <FormInput
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={item.unitPrice}
                    onChangeText={(text) => handleItemChange(index, 'unitPrice', text)}
                  />
                </View>
              </View>
              <FormLabel optional>Discount (amount)</FormLabel>
              <FormInput
                placeholder="0.00"
                keyboardType="numeric"
                value={item.discountAmount}
                onChangeText={(text) => handleItemChange(index, 'discountAmount', text)}
              />
            </View>
          ))}

          <Pressable style={styles.addItemButton} onPress={handleAddItem}>
            <AppIcon name="plus" size={14} color={colors.tint} />
            <Text style={[styles.addItemButtonText, { color: colors.tint }]}>Add item</Text>
          </Pressable>

          <FormLabel optional>Notes</FormLabel>
          <FormInput
            placeholder="Any extra notes for this quote"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>
      </ScrollView>
      <View
        style={[
          styles.stickyFooter,
          {
            backgroundColor: bg,
            borderTopColor: borderColor,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: colors.tint },
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
    </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  card: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  loadingHint: { fontSize: 14 },
  customerChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  customerChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  customerChipText: { fontSize: 13 },
  hint: { fontSize: 13, marginBottom: 4 },
  itemCard: {
    borderWidth: 1,
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
  itemTitle: { fontSize: 13, fontWeight: '600' },
  productPickerBlock: { marginBottom: 8 },
  productChipsRow: { gap: 8, paddingRight: 8 },
  productChip: {
    width: 160,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  productChipName: { fontSize: 13, fontWeight: '600' },
  productChipMeta: { fontSize: 12, marginTop: 2 },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
  },
  itemField: { flex: 1 },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  addItemButtonText: { fontSize: 14, fontWeight: '600' },
  primaryButton: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  stickyFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});

