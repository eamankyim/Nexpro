import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
import { invoiceService } from '@/services/invoiceService';
import { formatCurrency, formatDate } from '@/utils/formatCurrency';
import { formatStatusLabel } from '@/utils/formatLabels';
import { parseApiEntity } from '@/utils/parseApiListResponse';
import { refreshAfterInvoicePayment } from '@/utils/queryInvalidation';

type InvoiceDetail = {
  id: string;
  invoiceNumber?: string;
  total?: number;
  totalAmount?: number;
  status: string;
  dueDate?: string;
  createdAt: string;
  customer?: { name?: string };
  paidAmount?: number;
  amountPaid?: number;
  items?: Array<{ description: string; quantity: number; unitPrice: number }>;
};

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { bg, colors, borderColor, textColor, mutedColor } = useEntityDetailTheme();
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoiceService.getInvoiceById(String(id)),
    enabled: !!id,
  });

  const invoice = useMemo(() => parseApiEntity<InvoiceDetail>(data), [data]);

  const balance = useMemo(() => {
    if (!invoice) return 0;
    const total = Number(invoice.totalAmount ?? invoice.total ?? 0);
    const paid = Number(invoice.amountPaid ?? invoice.paidAmount ?? 0);
    return Math.max(0, total - paid);
  }, [invoice]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string) => {
      if (!invoice) return;
      setActionLoading(true);
      try {
        await action();
        await refetch();
        await refreshAfterInvoicePayment(queryClient);
        Alert.alert('Success', successMessage);
        setShowPaymentInput(false);
        setPaymentAmount('');
      } catch (err: unknown) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
      } finally {
        setActionLoading(false);
      }
    },
    [invoice, queryClient, refetch]
  );

  if (isLoading) return <DetailLoading title="Invoice" />;
  if (!invoice) return <DetailNotFound title="Invoice" entityLabel="Invoice" />;

  return (
    <>
      <EntityDetailHeader title={invoice.invoiceNumber || 'Invoice details'} />
      <ScreenShell style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <DetailCard>
            <DetailRow label="Total" value={formatCurrency(invoice.totalAmount ?? invoice.total)} valueColor={colors.tint} />
            {(invoice.amountPaid ?? invoice.paidAmount) ? (
              <DetailRow label="Paid" value={formatCurrency(invoice.amountPaid ?? invoice.paidAmount)} />
            ) : null}
            {balance > 0 ? (
              <DetailRow label="Balance" value={formatCurrency(balance)} valueColor="#ef4444" />
            ) : null}
            <DetailRow label="Customer" value={invoice.customer?.name ?? '—'} />
            <DetailRow label="Status" value={formatStatusLabel(invoice.status)} />
            {invoice.dueDate ? <DetailRow label="Due Date" value={formatDate(invoice.dueDate)} /> : null}
            <DetailRow label="Created" value={formatDate(invoice.createdAt)} />
          </DetailCard>
          {invoice.items && invoice.items.length > 0 ? (
            <DetailCard>
              <Text style={[styles.section, { color: textColor }]}>Items</Text>
              {invoice.items.map((item, i) => (
                <View key={i} style={styles.itemRow}>
                  <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                    {item.description} x{item.quantity}
                  </Text>
                  <Text style={[styles.itemTotal, { color: textColor }]}>
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </Text>
                </View>
              ))}
            </DetailCard>
          ) : null}
          {showPaymentInput && balance > 0 ? (
            <DetailCard>
              <Text style={[styles.label, { color: mutedColor }]}>
                Payment amount (balance {formatCurrency(balance)})
              </Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor }]}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="decimal-pad"
                placeholder={String(balance)}
                placeholderTextColor={mutedColor}
              />
            </DetailCard>
          ) : null}
        </ScrollView>
        <DetailFooter>
          {showPaymentInput ? (
            <>
              <DetailActionButton label="Back" onPress={() => setShowPaymentInput(false)} disabled={actionLoading} />
              <DetailActionButton
                label="Record"
                variant="primary"
                loading={actionLoading}
                onPress={() => {
                  const amount = parseFloat(paymentAmount);
                  if (!amount || amount <= 0) {
                    Alert.alert('Error', 'Enter a valid payment amount');
                    return;
                  }
                  if (amount > balance) {
                    Alert.alert('Error', 'Payment cannot exceed the balance');
                    return;
                  }
                  runAction(
                    () =>
                      invoiceService.recordPayment(invoice.id, {
                        amount,
                        paymentMethod: 'cash',
                        paymentDate: new Date().toISOString().slice(0, 10),
                      }),
                    'Payment recorded'
                  );
                }}
              />
            </>
          ) : (
            <>
              {invoice.status === 'draft' ? (
                <DetailActionButton
                  label="Send"
                  onPress={() =>
                    Alert.alert('Send invoice', 'Email this invoice to the customer?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Send',
                        onPress: () => runAction(() => invoiceService.send(invoice.id), 'Invoice sent'),
                      },
                    ])
                  }
                  disabled={actionLoading}
                />
              ) : null}
              {balance > 0 && invoice.status !== 'cancelled' && invoice.status !== 'paid' ? (
                <>
                  <DetailActionButton
                    label="Pay"
                    onPress={() => {
                      setPaymentAmount(balance.toFixed(2));
                      setShowPaymentInput(true);
                    }}
                    disabled={actionLoading}
                  />
                  <DetailActionButton
                    label="Mark paid"
                    variant="primary"
                    onPress={() =>
                      Alert.alert('Mark as paid', 'Mark this invoice as fully paid?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Mark paid',
                          onPress: () =>
                            runAction(() => invoiceService.markAsPaid(invoice.id), 'Invoice marked as paid'),
                        },
                      ])
                    }
                    disabled={actionLoading}
                  />
                </>
              ) : null}
            </>
          )}
        </DetailFooter>
      </ScreenShell>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  section: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemName: { flex: 1, fontSize: 14 },
  itemTotal: { fontSize: 14, fontWeight: '600' },
  label: { fontSize: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
});
