import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FormSheetModal } from '@/components/FormSheetModal';
import { formatCurrency } from '@/utils/formatCurrency';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

type DealerRecordPaymentSheetProps = {
  visible: boolean;
  balance: number;
  onClose: () => void;
  onSubmit: (payload: {
    amount: number;
    paymentMethod: PaymentMethod;
    referenceNumber?: string;
    notes?: string;
  }) => void;
  isSubmitting?: boolean;
  disabled?: boolean;
  cardBg: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  tintColor: string;
};

export function DealerRecordPaymentSheet({
  visible,
  balance,
  onClose,
  onSubmit,
  isSubmitting = false,
  disabled = false,
  cardBg,
  borderColor,
  textColor,
  mutedColor,
  tintColor,
}: DealerRecordPaymentSheetProps) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const isLocked = disabled || isSubmitting;

  useEffect(() => {
    if (!visible) return;
    setPaymentAmount(balance > 0 ? balance.toFixed(2) : '');
    setPaymentReference('');
    setPaymentNotes('');
    setPaymentMethod('cash');
  }, [balance, visible]);

  const handleSubmit = () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) return;
    onSubmit({
      amount,
      paymentMethod,
      referenceNumber: paymentReference.trim() || undefined,
      notes: paymentNotes.trim() || undefined,
    });
  };

  return (
    <FormSheetModal
      visible={visible}
      title="Record Payment"
      onClose={onClose}
      cardBg={cardBg}
      borderColor={borderColor}
      textColor={textColor}
      mutedColor={mutedColor}
      footer={
        <View style={styles.sheetActions}>
          <Pressable
            onPress={onClose}
            disabled={isLocked}
            style={[
              styles.sheetButton,
              styles.sheetButtonSecondary,
              { borderColor },
              isLocked && styles.disabledButton,
            ]}
          >
            <Text style={[styles.sheetButtonText, { color: textColor }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={isLocked}
            style={[
              styles.sheetButton,
              styles.sheetButtonPrimary,
              { backgroundColor: tintColor, borderColor: tintColor },
              isLocked && styles.disabledButton,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sheetButtonPrimaryText}>Record Payment</Text>
            )}
          </Pressable>
        </View>
      }
    >
      <View style={styles.paymentSummary}>
        <Text style={[styles.paymentSummaryLabel, { color: mutedColor }]}>Outstanding balance</Text>
        <Text style={[styles.paymentSummaryValue, { color: textColor }]}>{formatCurrency(balance)}</Text>
      </View>
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: mutedColor }]}>Amount</Text>
        <TextInput
          style={[styles.input, { color: textColor, borderColor, backgroundColor: cardBg }]}
          value={paymentAmount}
          onChangeText={setPaymentAmount}
          keyboardType="decimal-pad"
          placeholder={balance.toFixed(2)}
          placeholderTextColor={mutedColor}
          returnKeyType="done"
          editable={!isLocked}
        />
      </View>
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: mutedColor }]}>Payment method</Text>
        <View style={styles.methodRow}>
          {PAYMENT_METHODS.map((method) => (
            <Pressable
              key={method.value}
              onPress={() => setPaymentMethod(method.value)}
              disabled={isLocked}
              style={[
                styles.methodChip,
                { borderColor },
                paymentMethod === method.value && { backgroundColor: tintColor, borderColor: tintColor },
                isLocked && styles.disabledButton,
              ]}
            >
              <Text
                numberOfLines={2}
                style={[
                  styles.methodChipText,
                  { color: paymentMethod === method.value ? '#fff' : textColor },
                ]}
              >
                {method.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: mutedColor }]}>Reference number (optional)</Text>
        <TextInput
          style={[styles.input, { color: textColor, borderColor, backgroundColor: cardBg }]}
          value={paymentReference}
          onChangeText={setPaymentReference}
          placeholder="Receipt or transfer reference"
          placeholderTextColor={mutedColor}
          autoCapitalize="characters"
          returnKeyType="done"
          editable={!isLocked}
        />
      </View>
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: mutedColor }]}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea, { color: textColor, borderColor, backgroundColor: cardBg }]}
          value={paymentNotes}
          onChangeText={setPaymentNotes}
          placeholder="Payment notes"
          placeholderTextColor={mutedColor}
          multiline
          editable={!isLocked}
        />
      </View>
    </FormSheetModal>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  formGroup: { marginBottom: 18 },
  paymentSummary: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    padding: 14,
    marginBottom: 18,
  },
  paymentSummaryLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  paymentSummaryValue: { fontSize: 22, fontWeight: '800' },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    minHeight: 44,
    minWidth: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
  },
  methodChipText: { fontSize: 13, fontWeight: '700', lineHeight: 16, textAlign: 'center' },
  sheetActions: { flexDirection: 'row', gap: 10 },
  sheetButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sheetButtonSecondary: { backgroundColor: 'transparent' },
  sheetButtonPrimary: {},
  sheetButtonText: { fontSize: 15, fontWeight: '800' },
  sheetButtonPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  disabledButton: { opacity: 0.6 },
});
