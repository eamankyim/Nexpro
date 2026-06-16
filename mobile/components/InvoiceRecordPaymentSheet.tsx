import React, { useEffect, useMemo, useState } from 'react';
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
import {
  DIRECT_MOMO_PROVIDERS,
  isValidDirectMomoPhone,
  type DirectMomoProvider,
} from '@/utils/paymentCollection';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'card', label: 'Card' },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];
type PaymentFlow = 'direct' | 'manual';
type DirectPaymentStatus = 'idle' | 'pending' | 'success' | 'failed';

type InvoiceRecordPaymentSheetProps = {
  visible: boolean;
  balance: number;
  onClose: () => void;
  onSubmit: (payload: {
    amount: number;
    paymentMethod: PaymentMethod;
    referenceNumber?: string;
    paymentDate: string;
  }) => void;
  onDirectPayment?: (payload: { phoneNumber: string; provider: DirectMomoProvider }) => void;
  onCheckDirectStatus?: () => void;
  directProviders?: DirectMomoProvider[];
  directStatus?: DirectPaymentStatus;
  directReference?: string | null;
  directStatusMessage?: string | null;
  directPaymentAvailable?: boolean;
  directUnavailableReason?: string;
  isSubmitting?: boolean;
  disabled?: boolean;
  cardBg: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  tintColor: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function InvoiceRecordPaymentSheet({
  visible,
  balance,
  onClose,
  onSubmit,
  onDirectPayment,
  onCheckDirectStatus,
  directProviders = [],
  directStatus = 'idle',
  directReference,
  directStatusMessage,
  directPaymentAvailable = false,
  directUnavailableReason = 'Direct payment is not available for this invoice yet.',
  isSubmitting = false,
  disabled = false,
  cardBg,
  borderColor,
  textColor,
  mutedColor,
  tintColor,
}: InvoiceRecordPaymentSheetProps) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIsoDate());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlow>('direct');
  const [directPhoneNumber, setDirectPhoneNumber] = useState('');
  const [directProvider, setDirectProvider] = useState<DirectMomoProvider>('MTN');
  const isLocked = disabled || isSubmitting;
  const isDirectSelected = paymentFlow === 'direct';
  const availableDirectProviders = useMemo(
    () => DIRECT_MOMO_PROVIDERS.filter((provider) => directProviders.includes(provider.value)),
    [directProviders]
  );
  const canUseDirect = directPaymentAvailable && !!onDirectPayment && availableDirectProviders.length > 0;
  const normalizedDirectPhone = directPhoneNumber.trim();
  const canStartDirect = canUseDirect && isValidDirectMomoPhone(normalizedDirectPhone);
  const hasPendingDirectPayment = directStatus === 'pending' && Boolean(directReference);

  useEffect(() => {
    if (!visible) return;
    setPaymentAmount(balance > 0 ? balance.toFixed(2) : '');
    setPaymentReference('');
    setPaymentDate(todayIsoDate());
    setPaymentMethod('cash');
    setPaymentFlow(canUseDirect ? 'direct' : 'manual');
    setDirectPhoneNumber('');
    setDirectProvider(availableDirectProviders[0]?.value ?? 'MTN');
  }, [availableDirectProviders, balance, canUseDirect, visible]);

  const handleSubmit = () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) return;
    onSubmit({
      amount,
      paymentMethod,
      referenceNumber: paymentReference.trim() || undefined,
      paymentDate: paymentDate.trim(),
    });
  };

  const handlePrimaryAction = () => {
    if (isDirectSelected) {
      onDirectPayment?.({
        phoneNumber: normalizedDirectPhone,
        provider: directProvider,
      });
      return;
    }
    handleSubmit();
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
            onPress={handlePrimaryAction}
            disabled={isLocked || (isDirectSelected && !canStartDirect)}
            style={[
              styles.sheetButton,
              styles.sheetButtonPrimary,
              { backgroundColor: tintColor, borderColor: tintColor },
              (isLocked || (isDirectSelected && !canStartDirect)) && styles.disabledButton,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sheetButtonPrimaryText}>
                {isDirectSelected ? 'Start Direct Payment' : 'Record Payment'}
              </Text>
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
        <Text style={[styles.label, { color: mutedColor }]}>Payment option</Text>
        <View style={styles.flowRow}>
          <Pressable
            onPress={() => canUseDirect && setPaymentFlow('direct')}
            disabled={isLocked || !canUseDirect}
            style={[
              styles.flowCard,
              { borderColor, backgroundColor: cardBg },
              isDirectSelected && canUseDirect && { borderColor: tintColor, backgroundColor: '#f0fdf4' },
              (isLocked || !canUseDirect) && styles.disabledButton,
            ]}
          >
            <Text style={[styles.flowTitle, { color: textColor }]}>Direct</Text>
            <Text style={[styles.flowCopy, { color: mutedColor }]}>
              Send an in-app MoMo prompt to the customer phone and verify it here.
            </Text>
            {!canUseDirect ? (
              <Text style={styles.unavailableText}>{directUnavailableReason}</Text>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setPaymentFlow('manual')}
            disabled={isLocked}
            style={[
              styles.flowCard,
              { borderColor, backgroundColor: cardBg },
              paymentFlow === 'manual' && { borderColor: tintColor, backgroundColor: '#f0fdf4' },
              isLocked && styles.disabledButton,
            ]}
          >
            <Text style={[styles.flowTitle, { color: textColor }]}>Manual</Text>
            <Text style={[styles.flowCopy, { color: mutedColor }]}>
              Record cash, card, or MoMo already received by the business.
            </Text>
          </Pressable>
        </View>
      </View>
      {isDirectSelected ? (
        <>
          <View style={[styles.directInfo, { borderColor }]}>
            <Text style={[styles.directInfoTitle, { color: textColor }]}>Mobile Money direct collection</Text>
            <Text style={[styles.directInfoCopy, { color: mutedColor }]}>
              The customer receives a MoMo approval or PIN prompt on their phone. Keep this sheet open and check status after they approve.
            </Text>
          </View>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: mutedColor }]}>MoMo network</Text>
            <View style={styles.methodRow}>
              {availableDirectProviders.map((provider) => (
                <Pressable
                  key={provider.value}
                  onPress={() => setDirectProvider(provider.value)}
                  disabled={isLocked}
                  style={[
                    styles.methodChip,
                    { borderColor },
                    directProvider === provider.value && { backgroundColor: tintColor, borderColor: tintColor },
                    isLocked && styles.disabledButton,
                  ]}
                >
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.methodChipText,
                      { color: directProvider === provider.value ? '#fff' : textColor },
                    ]}
                  >
                    {provider.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: mutedColor }]}>Customer MoMo phone</Text>
            <TextInput
              style={[styles.input, { color: textColor, borderColor, backgroundColor: cardBg }]}
              value={directPhoneNumber}
              onChangeText={setDirectPhoneNumber}
              keyboardType="phone-pad"
              placeholder="0XX XXX XXXX"
              placeholderTextColor={mutedColor}
              returnKeyType="done"
              editable={!isLocked}
            />
            {normalizedDirectPhone && !isValidDirectMomoPhone(normalizedDirectPhone) ? (
              <Text style={styles.unavailableText}>Enter a valid Ghana MoMo number, for example 024 XXX XXXX.</Text>
            ) : null}
          </View>
          {hasPendingDirectPayment || directStatusMessage ? (
            <View style={[styles.directInfo, { borderColor }]}>
              <Text style={[styles.directInfoTitle, { color: textColor }]}>
                {directStatus === 'success' ? 'Payment confirmed' : directStatus === 'failed' ? 'Payment not completed' : 'Waiting for approval'}
              </Text>
              <Text style={[styles.directInfoCopy, { color: mutedColor }]}>
                {directStatusMessage || 'Ask the customer to approve the prompt, then check the status.'}
              </Text>
              {directReference ? (
                <Text style={[styles.referenceText, { color: mutedColor }]}>Reference: {directReference}</Text>
              ) : null}
              {onCheckDirectStatus && directStatus !== 'success' ? (
                <Pressable
                  onPress={onCheckDirectStatus}
                  disabled={isLocked}
                  style={[styles.checkStatusButton, { borderColor }, isLocked && styles.disabledButton]}
                >
                  <Text style={[styles.checkStatusText, { color: textColor }]}>Check status</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <>
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
              placeholder="Receipt, transfer, or POS reference"
              placeholderTextColor={mutedColor}
              autoCapitalize="characters"
              returnKeyType="done"
              editable={!isLocked}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: mutedColor }]}>Payment date</Text>
            <TextInput
              style={[styles.input, { color: textColor, borderColor, backgroundColor: cardBg }]}
              value={paymentDate}
              onChangeText={setPaymentDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={mutedColor}
              returnKeyType="done"
              editable={!isLocked}
            />
          </View>
        </>
      )}
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
    marginBottom: 12,
  },
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
  flowRow: { gap: 10 },
  flowCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  flowTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  flowCopy: { fontSize: 13, lineHeight: 18 },
  unavailableText: { color: '#b45309', fontSize: 12, lineHeight: 16, marginTop: 8, fontWeight: '700' },
  directInfo: {
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    padding: 14,
    marginBottom: 18,
  },
  directInfoTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  directInfoCopy: { fontSize: 13, lineHeight: 18 },
  referenceText: { fontSize: 12, lineHeight: 16, marginTop: 8, fontWeight: '700' },
  checkStatusButton: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
  },
  checkStatusText: { fontSize: 14, fontWeight: '800' },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodChip: {
    flex: 1,
    minHeight: 44,
    minWidth: 0,
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
