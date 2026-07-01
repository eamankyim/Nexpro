import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

import { FormSheetModal } from '@/components/FormSheetModal';
import {
  getMaxQuantityForCartItem,
  validateCartQuantityInput,
  type ProductStockInput,
} from '@/utils/productStock';

type CartQuantityItem = {
  id: string;
  name: string;
  quantity: number;
} & ProductStockInput;

type CartQuantitySheetProps = {
  visible: boolean;
  item: CartQuantityItem | null;
  onClose: () => void;
  onApply: (itemId: string, quantity: number) => void;
  cardBg?: string;
  borderColor?: string;
  textColor?: string;
  mutedColor?: string;
  inputBg?: string;
  tintColor?: string;
};

export function CartQuantitySheet({
  visible,
  item,
  onClose,
  onApply,
  cardBg,
  borderColor,
  textColor,
  mutedColor,
  inputBg,
  tintColor = '#166534',
}: CartQuantitySheetProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && item) {
      setValue(String(item.quantity));
      setError('');
    }
  }, [visible, item]);

  const maxQty = item ? getMaxQuantityForCartItem(item) : null;

  const handleApply = useCallback(() => {
    if (!item) return;
    const result = validateCartQuantityInput(value, item);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    onApply(item.id, result.quantity);
    onClose();
  }, [item, value, onApply, onClose]);

  return (
    <FormSheetModal
      visible={visible}
      title={item ? `Quantity: ${item.name}` : 'Quantity'}
      onClose={onClose}
      cardBg={cardBg}
      borderColor={borderColor}
      textColor={textColor}
      mutedColor={mutedColor}
      footer={
        <View style={styles.footerActions}>
          <Pressable
            onPress={onClose}
            style={[styles.secondaryBtn, { borderColor }]}
            accessibilityLabel="Cancel quantity edit"
          >
            <Text style={[styles.secondaryBtnText, { color: textColor }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleApply}
            style={[styles.primaryBtn, { backgroundColor: tintColor }]}
            accessibilityLabel="Apply quantity"
          >
            <Text style={styles.primaryBtnText}>Apply</Text>
          </Pressable>
        </View>
      }
    >
      <Text style={[styles.label, { color: mutedColor }]}>
        {maxQty !== null ? `In stock: ${maxQty}` : 'Enter quantity (0 removes item)'}
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            color: textColor,
            borderColor,
            backgroundColor: inputBg,
          },
        ]}
        value={value}
        onChangeText={(text) => {
          setValue(text.replace(/[^\d]/g, ''));
          setError('');
        }}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel="Quantity"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </FormSheetModal>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#dc2626',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
