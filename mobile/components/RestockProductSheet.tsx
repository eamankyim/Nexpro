import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FormSheetModal } from '@/components/FormSheetModal';

type RestockProduct = {
  id: string;
  name: string;
  quantityOnHand?: number | null;
  unit?: string | null;
};

type RestockProductSheetProps = {
  visible: boolean;
  product: RestockProduct | null;
  onClose: () => void;
  onSubmit: (quantity: number) => void;
  isSubmitting?: boolean;
  cardBg: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  inputBg: string;
  tintColor: string;
};

export function RestockProductSheet({
  visible,
  product,
  onClose,
  onSubmit,
  isSubmitting = false,
  cardBg,
  borderColor,
  textColor,
  mutedColor,
  inputBg,
  tintColor,
}: RestockProductSheetProps) {
  const [quantity, setQuantity] = useState('1');

  useEffect(() => {
    if (visible) setQuantity('1');
  }, [visible, product?.id]);

  const currentStock = useMemo(() => {
    const stock = Number(product?.quantityOnHand ?? 0);
    return Number.isFinite(stock) ? stock : 0;
  }, [product?.quantityOnHand]);

  const handleSubmit = () => {
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert('Invalid quantity', 'Enter a quantity greater than zero.');
      return;
    }
    onSubmit(parsedQuantity);
  };

  return (
    <FormSheetModal
      visible={visible}
      title="Restock product"
      onClose={onClose}
      cardBg={cardBg}
      borderColor={borderColor}
      textColor={textColor}
      mutedColor={mutedColor}
      footer={
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting || !product}
          style={[
            styles.submitButton,
            { backgroundColor: tintColor },
            (isSubmitting || !product) && styles.submitButtonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Add stock</Text>
          )}
        </Pressable>
      }
    >
      <View style={[styles.summaryCard, { borderColor, backgroundColor: inputBg }]}>
        <Text style={[styles.productName, { color: textColor }]} numberOfLines={2}>
          {product?.name || 'Product'}
        </Text>
        <Text style={[styles.currentStock, { color: mutedColor }]}>
          Current stock: {currentStock} {product?.unit || 'units'}
        </Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: textColor }]}>Quantity received</Text>
        <TextInput
          style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
          placeholder="1"
          placeholderTextColor={mutedColor}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          autoFocus
        />
      </View>

      <Text style={[styles.hint, { color: mutedColor }]}>
        This adds to the current stock and records the change as received stock.
      </Text>
    </FormSheetModal>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  productName: { fontSize: 18, fontWeight: '700' },
  currentStock: { fontSize: 14, marginTop: 6 },
  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  hint: { fontSize: 13, lineHeight: 18 },
  submitButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  submitButtonDisabled: { opacity: 0.6 },
});
