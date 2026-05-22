import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
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
import { materialsService } from '@/services/materialsService';
import { formatCurrency } from '@/utils/formatCurrency';
import { getApiErrorMessage, parseApiEntity } from '@/utils/parseApiListResponse';
import { refreshAfterMaterialChange } from '@/utils/queryInvalidation';

type MaterialDetail = {
  id: string;
  name: string;
  sku?: string;
  quantityOnHand: number;
  reorderLevel?: number;
  unitCost?: number;
  unit?: string;
  category?: { id: string; name: string };
};

function getStockStatus(quantity: number, reorderLevel: number) {
  if (quantity <= 0) return { color: '#ef4444', label: 'Out of stock' };
  if (quantity <= reorderLevel) return { color: '#f59e0b', label: 'Low stock' };
  return { color: '#10b981', label: 'In stock' };
}

export default function MaterialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { bg, colors, cardBg, borderColor, textColor, mutedColor } = useEntityDetailTheme();
  const inputBg = bg === '#f9fafb' ? '#f9fafb' : '#18181b';

  const [restockOpen, setRestockOpen] = useState(false);
  const [restockData, setRestockData] = useState({ quantity: '', unitCost: '', reference: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['material', id],
    queryFn: () => materialsService.getItemById(String(id)),
    enabled: !!id,
  });

  const item = useMemo(() => parseApiEntity<MaterialDetail>(data), [data]);

  const restockMutation = useMutation({
    mutationFn: () =>
      materialsService.restock(String(id), {
        quantity: parseFloat(restockData.quantity),
        unitCost: restockData.unitCost ? parseFloat(restockData.unitCost) : undefined,
        reference: restockData.reference.trim() || undefined,
      }),
    onSuccess: async () => {
      await refreshAfterMaterialChange(queryClient);
      setRestockOpen(false);
      setRestockData({ quantity: '', unitCost: '', reference: '' });
      Alert.alert('Success', 'Materials restocked successfully');
    },
    onError: (err: unknown) => {
      Alert.alert('Error', getApiErrorMessage(err, 'Failed to restock materials'));
    },
  });

  const handleRestock = useCallback(() => {
    const qty = parseFloat(restockData.quantity);
    if (!qty || qty <= 0) {
      Alert.alert('Error', 'Enter a valid quantity');
      return;
    }
    restockMutation.mutate();
  }, [restockData.quantity, restockMutation]);

  if (isLoading) return <DetailLoading title="Material" />;
  if (!item) return <DetailNotFound title="Material" entityLabel="Material" />;

  const stock = getStockStatus(item.quantityOnHand, item.reorderLevel || 0);

  return (
    <>
      <EntityDetailHeader title={item.name || 'Material'} />
      <ScreenShell style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <DetailCard>
            <DetailRow label="Name" value={item.name} />
            {item.sku ? <DetailRow label="SKU" value={item.sku} /> : null}
            <DetailRow label="Stock">
              <Text style={[styles.stock, { color: stock.color }]}>
                {item.quantityOnHand} {item.unit || 'units'}
              </Text>
            </DetailRow>
            {item.reorderLevel !== undefined ? (
              <DetailRow label="Reorder Level" value={`${item.reorderLevel} ${item.unit || 'units'}`} />
            ) : null}
            {item.unitCost ? <DetailRow label="Unit Cost" value={formatCurrency(item.unitCost)} /> : null}
            {item.category ? <DetailRow label="Category" value={item.category.name} /> : null}
          </DetailCard>
        </ScrollView>
        <DetailFooter>
          <DetailActionButton
            label={FORM_LABELS.material.restock}
            icon="plus"
            variant="primary"
            onPress={() => setRestockOpen(true)}
          />
        </DetailFooter>
      </ScreenShell>

      <FormSheetModal
        visible={restockOpen}
        title={FORM_LABELS.material.restockTitle}
        onClose={() => setRestockOpen(false)}
        cardBg={cardBg}
        borderColor={borderColor}
        textColor={textColor}
        mutedColor={mutedColor}
        footer={
          <Pressable
            onPress={handleRestock}
            disabled={restockMutation.isPending}
            style={[styles.submitBtn, { backgroundColor: colors.tint }]}
          >
            {restockMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{FORM_LABELS.material.restock}</Text>
            )}
          </Pressable>
        }
      >
        <DetailRow label="Item" value={item.name} />
        <DetailRow label="Current Stock" value={`${item.quantityOnHand} ${item.unit || 'units'}`} />
        <Text style={[styles.label, { color: textColor }]}>{FORM_LABELS.material.quantityToAdd}</Text>
        <TextInput
          style={[styles.input, { color: textColor, borderColor, backgroundColor: inputBg }]}
          placeholder="0"
          placeholderTextColor={mutedColor}
          value={restockData.quantity}
          onChangeText={(t) => setRestockData((p) => ({ ...p, quantity: t }))}
          keyboardType="decimal-pad"
        />
        <Text style={[styles.label, { color: textColor }]}>{FORM_LABELS.material.unitCost}</Text>
        <TextInput
          style={[styles.input, { color: textColor, borderColor, backgroundColor: inputBg }]}
          placeholder="0.00"
          placeholderTextColor={mutedColor}
          value={restockData.unitCost}
          onChangeText={(t) => setRestockData((p) => ({ ...p, unitCost: t }))}
          keyboardType="decimal-pad"
        />
        <Text style={[styles.label, { color: textColor }]}>{FORM_LABELS.material.reference}</Text>
        <TextInput
          style={[styles.input, { color: textColor, borderColor, backgroundColor: inputBg }]}
          placeholder="Invoice number, PO, etc."
          placeholderTextColor={mutedColor}
          value={restockData.reference}
          onChangeText={(t) => setRestockData((p) => ({ ...p, reference: t }))}
        />
      </FormSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16 },
  stock: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 8 },
  submitBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
