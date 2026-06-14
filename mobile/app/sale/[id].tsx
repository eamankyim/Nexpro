import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

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
  useEntityDetailTheme,
} from '@/components/EntityDetailLayout';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/context/AuthContext';
import { useExclusiveAction } from '@/hooks/useExclusiveAction';
import { useShopOptional } from '@/context/ShopContext';
import { useStudioLocationOptional } from '@/context/StudioLocationContext';
import { shareReceiptPdf } from '@/services/pdfDocumentService';
import { invoiceService } from '@/services/invoiceService';
import { saleService } from '@/services/saleService';
import { formatCurrency, formatDate } from '@/utils/formatCurrency';
import { formatStatusLabel } from '@/utils/formatLabels';
import { parseApiEntity, parseApiListResponse } from '@/utils/parseApiListResponse';
import { refreshAfterSale } from '@/utils/queryInvalidation';
import { resolveImageUrl } from '@/utils/fileUtils';
import { DeliveryStatusPicker } from '@/components/DeliveryStatusPicker';

type SaleItemDetail = {
  id?: string;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice?: number;
  total: number;
  product?: { name?: string; imageUrl?: string | null };
};

type SaleDetail = {
  id: string;
  saleNumber?: string;
  total: number;
  amountPaid?: number;
  status: string;
  invoiceId?: string | null;
  invoice?: { id?: string; invoiceNumber?: string } | null;
  deliveryStatus?: string | null;
  createdAt: string;
  customer?: { name?: string; phone?: string; email?: string };
  shop?: { name?: string };
  studioLocation?: { name?: string };
  items?: SaleItemDetail[];
};

type SaleAction = 'receipt' | 'payment' | 'cancel' | 'deliveryStatus' | 'invoice' | 'delete';

function getSaleItemImageUrl(item: SaleItemDetail): string | null {
  const raw = item.product?.imageUrl;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed.startsWith('undefined')) {
    return null;
  }
  return resolveImageUrl(trimmed);
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile' },
  { value: 'card', label: 'Card' },
] as const;

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeTenant, isAdmin } = useAuth();
  const shopContext = useShopOptional();
  const studioContext = useStudioLocationOptional();
  const { bg, colors, cardBg, borderColor, textColor, mutedColor } = useEntityDetailTheme();

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]['value']>('cash');
  const { isAnyActionActive, isActionActive, runExclusiveAction } = useExclusiveAction<SaleAction>();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => saleService.getSaleById(String(id)),
    enabled: !!id,
  });

  const sale = useMemo(() => parseApiEntity<SaleDetail>(data), [data]);

  const { data: linkedInvoicesResponse } = useQuery({
    queryKey: ['invoices', 'sale-link', id],
    queryFn: () => invoiceService.getInvoices({ saleId: String(id), limit: 1 }),
    enabled: !!id && !sale?.invoiceId && !sale?.invoice?.id,
  });

  const linkedInvoiceId = useMemo(() => {
    if (sale?.invoiceId) return sale.invoiceId;
    if (sale?.invoice?.id) return sale.invoice.id;
    const [invoice] = parseApiListResponse<{ id?: string }>(linkedInvoicesResponse);
    return invoice?.id ?? null;
  }, [linkedInvoicesResponse, sale?.invoiceId, sale?.invoice?.id]);

  const balance = useMemo(() => {
    if (!sale) return 0;
    return Math.max(0, Number(sale.total || 0) - Number(sale.amountPaid || 0));
  }, [sale]);

  const canRecordPayment =
    sale && balance > 0 && sale.status !== 'cancelled' && sale.status !== 'refunded';

  const deliveryStatusMutation = useMutation({
    mutationFn: (deliveryStatus: string | null) =>
      saleService.updateDeliveryStatus(String(id), deliveryStatus),
    onSuccess: async () => {
      await refetch();
      await refreshAfterSale(queryClient);
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      Alert.alert('Update failed', err?.response?.data?.message || err?.message || 'Could not update delivery status');
    },
  });

  const refresh = useCallback(async () => {
    await refetch();
    await refreshAfterSale(queryClient);
  }, [queryClient, refetch]);

  const handleDownloadReceipt = useCallback(async () => {
    if (!sale) return;
    await runExclusiveAction('receipt', async () => {
      try {
        let saleForReceipt: SaleDetail = sale;
        try {
          const res = await saleService.getReceipt(sale.id);
          const full = res?.data ?? res;
          if (full && typeof full === 'object') saleForReceipt = full as SaleDetail;
        } catch {
          // use sale
        }
        await shareReceiptPdf({
          ...saleForReceipt,
          shop: saleForReceipt?.shop ?? shopContext?.activeShop ?? undefined,
          studioLocation: saleForReceipt?.studioLocation ?? studioContext?.activeLocation ?? undefined,
          tenantName: activeTenant?.name,
        });
      } catch (err: unknown) {
        Alert.alert('Receipt unavailable', err instanceof Error ? err.message : 'Could not prepare this receipt PDF.');
      }
    });
  }, [activeTenant?.name, runExclusiveAction, sale, shopContext?.activeShop, studioContext?.activeLocation]);

  const handleRecordPayment = useCallback(async () => {
    if (!sale) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Enter a valid payment amount');
      return;
    }
    if (amount > balance) {
      Alert.alert('Error', `Amount cannot exceed balance (${formatCurrency(balance)})`);
      return;
    }
    await runExclusiveAction('payment', async () => {
      try {
        await saleService.recordPayment(sale.id, {
          amount,
          paymentMethod,
          referenceNumber: paymentReference.trim() || undefined,
          paymentDate: new Date().toISOString().slice(0, 10),
        });
        await refresh();
        setShowPaymentForm(false);
        setPaymentAmount('');
        Alert.alert('Success', 'Payment recorded');
      } catch (err: unknown) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to record payment');
      }
    });
  }, [balance, paymentAmount, paymentMethod, paymentReference, refresh, runExclusiveAction, sale]);

  const handleCancelSale = useCallback(() => {
    if (!sale) return;
    Alert.alert('Cancel sale', 'Cancel this sale and restore stock?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel sale',
        style: 'destructive',
        onPress: async () => {
          await runExclusiveAction('cancel', async () => {
            try {
              await saleService.cancelSale(sale.id);
              await refresh();
              Alert.alert('Success', 'Sale cancelled');
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel sale');
            }
          });
        },
      },
    ]);
  }, [refresh, runExclusiveAction, sale]);

  const handleInvoiceAction = useCallback(async () => {
    if (!sale) return;
    if (linkedInvoiceId) {
      router.push(`/invoice/${encodeURIComponent(linkedInvoiceId)}` as never);
      return;
    }
    await runExclusiveAction('invoice', async () => {
      try {
        const res = await saleService.generateInvoice(sale.id);
        await refresh();
        const payload = res?.data ?? res;
        const invoiceId =
          (payload as { invoice?: { id?: string } })?.invoice?.id ??
          (payload as { id?: string })?.id ??
          (payload as { invoiceId?: string })?.invoiceId;
        if (invoiceId) {
          router.push(`/invoice/${encodeURIComponent(invoiceId)}` as never);
          return;
        }
        Alert.alert('Invoice created', 'The invoice was created for this sale.');
      } catch (err: unknown) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create invoice');
      }
    });
  }, [linkedInvoiceId, refresh, router, runExclusiveAction, sale]);

  const handleDeleteSale = useCallback(() => {
    if (!sale) return;
    Alert.alert('Delete sale', 'Delete this sale permanently? This is only allowed when the backend considers it safe.', [
      { text: 'Keep sale', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          runExclusiveAction('delete', async () => {
            try {
              await saleService.deleteSale(sale.id);
              await refreshAfterSale(queryClient);
              Alert.alert('Deleted', 'Sale deleted');
              router.back();
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete sale');
            }
          }),
      },
    ]);
  }, [queryClient, router, runExclusiveAction, sale]);

  if (isLoading) return <DetailLoading title="Sale" />;
  if (!sale) return <DetailNotFound title="Sale" entityLabel="Sale" />;

  const salePrimaryIsPayment = Boolean(canRecordPayment);
  const saleMoreActions: DetailMoreAction[] = [
    ...(salePrimaryIsPayment
      ? [{
          key: 'receipt',
          label: 'Download Receipt',
          icon: 'download' as const,
          onPress: handleDownloadReceipt,
          loading: isActionActive('receipt'),
          disabled: isAnyActionActive,
        }]
      : []),
    {
      key: 'invoice',
      label: linkedInvoiceId ? 'View invoice' : 'Create invoice',
      icon: 'file-text',
      onPress: handleInvoiceAction,
      loading: isActionActive('invoice'),
      disabled: isAnyActionActive,
    },
    ...(sale.status !== 'cancelled' && sale.status !== 'refunded'
      ? [{
          key: 'cancel',
          label: 'Cancel',
          variant: 'danger' as const,
          onPress: handleCancelSale,
          loading: isActionActive('cancel'),
          disabled: isAnyActionActive,
        }]
      : []),
    ...(isAdmin
      ? [{
          key: 'delete',
          label: 'Delete',
          variant: 'danger' as const,
          onPress: handleDeleteSale,
          loading: isActionActive('delete'),
          disabled: isAnyActionActive,
        }]
      : []),
  ];

  return (
    <>
      <EntityDetailHeader title={sale.saleNumber || 'Sale details'} />
      <ScreenShell style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <DetailHeroCard
            eyebrow={sale.saleNumber || 'Sale'}
            title={formatStatusLabel(sale.status)}
            message={balance > 0 ? 'This sale still has an outstanding balance.' : 'This sale is paid or complete.'}
            metricLabel="Total Amount"
            metricValue={formatCurrency(sale.total)}
            secondaryIcon="archive"
            secondaryLabel="Items"
            secondaryValue={`${sale.items?.length || 0} ${(sale.items?.length || 0) === 1 ? 'Item' : 'Items'}`}
          />

          <DetailSectionCard title="Sale Details" icon="receipt">
            <DetailInfoRow icon="user" label="Customer" value={sale.customer?.name ?? 'Walk-in'} />
            <DetailInfoRow icon="calendar" label="Date" value={formatDate(sale.createdAt)} />
            <DetailInfoRow icon="tag" label="Status" value={formatStatusLabel(sale.status)} />
            {Number(sale.amountPaid || 0) > 0 ? (
              <DetailInfoRow icon="credit-card" label="Paid" value={formatCurrency(sale.amountPaid)} />
            ) : null}
            {balance > 0 ? (
              <DetailInfoRow icon="credit-card" label="Balance" value={formatCurrency(balance)} valueColor="#ef4444" />
            ) : null}
            <DetailInfoRow icon="truck" label="Delivery status">
              <DeliveryStatusPicker
                value={sale.deliveryStatus}
                onChange={(nextStatus) => {
                  runExclusiveAction('deliveryStatus', () => deliveryStatusMutation.mutateAsync(nextStatus));
                }}
                cardBg={cardBg}
                borderColor={borderColor}
                textColor={textColor}
                mutedColor={mutedColor}
                tintColor={colors.tint}
                loading={isActionActive('deliveryStatus')}
                disabled={isAnyActionActive || sale.status !== 'completed'}
              />
            </DetailInfoRow>
          </DetailSectionCard>
          {sale.items && sale.items.length > 0 ? (
            <DetailSectionCard title="Sale Items" icon="archive">
              <Text style={[styles.section, { color: textColor }]}>Items</Text>
              {sale.items.map((item, i) => {
                const imageUri = getSaleItemImageUrl(item);
                const displayName = item.name || item.product?.name || 'Product';
                return (
                  <View
                    key={item.id ?? i}
                    style={[styles.itemRow, i > 0 && { borderTopColor: borderColor, borderTopWidth: 1 }]}
                  >
                    {imageUri ? (
                      <Image
                        source={{ uri: imageUri }}
                        style={[styles.itemImage, { borderColor }]}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.itemImagePlaceholder, { borderColor }]}>
                        <AppIcon name="archive" size={18} color={mutedColor} />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: textColor }]} numberOfLines={2}>
                        {displayName} x{item.quantity}
                      </Text>
                      {item.sku ? (
                        <Text style={[styles.itemSku, { color: mutedColor }]} numberOfLines={1}>
                          SKU: {item.sku}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.itemTotal, { color: textColor }]}>
                      {formatCurrency(item.total)}
                    </Text>
                  </View>
                );
              })}
            </DetailSectionCard>
          ) : null}
          {showPaymentForm && canRecordPayment ? (
            <DetailSectionCard title="Record Payment" icon="credit-card">
              <Text style={[styles.label, { color: mutedColor }]}>
                Amount (max {formatCurrency(balance)})
              </Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor }]}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="decimal-pad"
                placeholder={String(balance)}
                placeholderTextColor={mutedColor}
              />
              <View style={styles.methodRow}>
                {PAYMENT_METHODS.map((m) => (
                  <Pressable
                    key={m.value}
                    onPress={() => setPaymentMethod(m.value)}
                    style={[
                      styles.methodChip,
                      { borderColor },
                      paymentMethod === m.value && { backgroundColor: colors.tint, borderColor: colors.tint },
                    ]}
                  >
                    <Text style={{ color: paymentMethod === m.value ? '#fff' : textColor, fontWeight: '600' }}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </DetailSectionCard>
          ) : null}
        </ScrollView>
        <DetailFooter>
          {showPaymentForm ? (
            <>
              <DetailActionButton label="Back" onPress={() => setShowPaymentForm(false)} disabled={isAnyActionActive} />
              <DetailActionButton
                label="Record"
                variant="primary"
                loading={isActionActive('payment')}
                disabled={isAnyActionActive}
                onPress={handleRecordPayment}
              />
            </>
          ) : (
            <>
              {salePrimaryIsPayment ? (
                <DetailActionButton
                  label="Pay"
                  variant="primary"
                  onPress={() => {
                    setPaymentAmount(balance.toFixed(2));
                    setShowPaymentForm(true);
                  }}
                  disabled={isAnyActionActive}
                />
              ) : (
                <DetailActionButton
                  label="Download Receipt"
                  icon="download"
                  variant="primary"
                  onPress={handleDownloadReceipt}
                  loading={isActionActive('receipt')}
                  disabled={isAnyActionActive}
                />
              )}
              <DetailMoreActions actions={saleMoreActions} disabled={isAnyActionActive} />
            </>
          )}
        </DetailFooter>
      </ScreenShell>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16 },
  thumbRow: { marginBottom: 12 },
  thumbRowContent: { gap: 8 },
  thumbImage: { width: 56, height: 56, borderRadius: 10, borderWidth: 1 },
  section: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  itemImage: { width: 48, height: 48, borderRadius: 10, borderWidth: 1 },
  itemImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: '500' },
  itemSku: { fontSize: 12, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '600' },
  label: { fontSize: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 12 },
  methodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  methodChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
});
