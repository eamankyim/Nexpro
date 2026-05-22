import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Share,
  Pressable,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { AppIcon } from '@/components/AppIcon';
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
import { useAuth } from '@/context/AuthContext';
import { useShopOptional } from '@/context/ShopContext';
import { useStudioLocationOptional } from '@/context/StudioLocationContext';
import { saleService } from '@/services/saleService';
import { formatCurrency, formatDate } from '@/utils/formatCurrency';
import { formatSaleReceiptText } from '@/utils/formatSaleReceipt';
import { formatStatusLabel } from '@/utils/formatLabels';
import { parseApiEntity } from '@/utils/parseApiListResponse';
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
  deliveryStatus?: string | null;
  createdAt: string;
  customer?: { name?: string; phone?: string; email?: string };
  shop?: { name?: string };
  studioLocation?: { name?: string };
  items?: SaleItemDetail[];
};

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
  const queryClient = useQueryClient();
  const { activeTenant } = useAuth();
  const shopContext = useShopOptional();
  const studioContext = useStudioLocationOptional();
  const { bg, colors, cardBg, borderColor, textColor, mutedColor } = useEntityDetailTheme();

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]['value']>('cash');
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => saleService.getSaleById(String(id)),
    enabled: !!id,
  });

  const sale = useMemo(() => parseApiEntity<SaleDetail>(data), [data]);

  const balance = useMemo(() => {
    if (!sale) return 0;
    return Math.max(0, Number(sale.total || 0) - Number(sale.amountPaid || 0));
  }, [sale]);

  const canRecordPayment =
    sale && balance > 0 && sale.status !== 'cancelled' && sale.status !== 'refunded';

  const itemsWithImages = useMemo(
    () => (sale?.items ?? []).filter((item) => !!getSaleItemImageUrl(item)),
    [sale?.items]
  );

  const deliveryStatusMutation = useMutation({
    mutationFn: (deliveryStatus: string | null) =>
      saleService.updateDeliveryStatus(String(id), deliveryStatus),
    onSuccess: async () => {
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'infinite'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries-queue'] });
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      Alert.alert('Update failed', err?.response?.data?.message || err?.message || 'Could not update delivery status');
    },
  });

  const refresh = useCallback(async () => {
    await refetch();
    await refreshAfterSale(queryClient);
  }, [queryClient, refetch]);

  const handleShareReceipt = useCallback(async () => {
    if (!sale) return;
    setActionLoading(true);
    try {
      let saleForReceipt: SaleDetail = sale;
      try {
        const res = await saleService.getReceipt(sale.id);
        const full = res?.data ?? res;
        if (full && typeof full === 'object') saleForReceipt = full as SaleDetail;
      } catch {
        // use sale
      }
      await Share.share({
        message: formatSaleReceiptText({
          ...saleForReceipt,
          shop: saleForReceipt?.shop ?? shopContext?.activeShop ?? undefined,
          studioLocation: saleForReceipt?.studioLocation ?? studioContext?.activeLocation ?? undefined,
          tenantName: activeTenant?.name,
        }),
        title: `Receipt ${saleForReceipt.saleNumber || ''}`.trim(),
      });
    } catch (err: unknown) {
      if ((err as { message?: string })?.message !== 'User did not share') {
        Alert.alert('Error', 'Could not share receipt');
      }
    } finally {
      setActionLoading(false);
    }
  }, [activeTenant?.name, sale, shopContext?.activeShop, studioContext?.activeLocation]);

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
    setActionLoading(true);
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
    } finally {
      setActionLoading(false);
    }
  }, [balance, paymentAmount, paymentMethod, paymentReference, refresh, sale]);

  const handleCancelSale = useCallback(() => {
    if (!sale) return;
    Alert.alert('Cancel sale', 'Cancel this sale and restore stock?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel sale',
        style: 'destructive',
        onPress: async () => {
          setCancelLoading(true);
          try {
            await saleService.cancelSale(sale.id);
            await refresh();
            Alert.alert('Success', 'Sale cancelled');
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel sale');
          } finally {
            setCancelLoading(false);
          }
        },
      },
    ]);
  }, [refresh, sale]);

  if (isLoading) return <DetailLoading title="Sale" />;
  if (!sale) return <DetailNotFound title="Sale" entityLabel="Sale" />;

  return (
    <>
      <EntityDetailHeader title={sale.saleNumber || 'Sale details'} />
      <ScreenShell style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <DetailCard>
            {itemsWithImages.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.thumbRow}
                contentContainerStyle={styles.thumbRowContent}
              >
                {itemsWithImages.map((item, index) => {
                  const uri = getSaleItemImageUrl(item);
                  if (!uri) return null;
                  return (
                    <Image
                      key={item.id ?? `${item.name}-${index}`}
                      source={{ uri }}
                      style={[styles.thumbImage, { borderColor }]}
                      contentFit="cover"
                    />
                  );
                })}
              </ScrollView>
            ) : null}
            <DetailRow label="Total" value={formatCurrency(sale.total)} />
            {Number(sale.amountPaid || 0) > 0 ? (
              <DetailRow label="Paid" value={formatCurrency(sale.amountPaid)} />
            ) : null}
            {balance > 0 ? (
              <DetailRow label="Balance" value={formatCurrency(balance)} valueColor="#ef4444" />
            ) : null}
            <DetailRow label="Customer" value={sale.customer?.name ?? 'Walk-in'} />
            <DetailRow label="Date" value={formatDate(sale.createdAt)} />
            <DetailRow label="Status" value={formatStatusLabel(sale.status)} />
            <DetailRow label="Delivery status">
              <DeliveryStatusPicker
                value={sale.deliveryStatus}
                onChange={(nextStatus) => deliveryStatusMutation.mutate(nextStatus)}
                cardBg={cardBg}
                borderColor={borderColor}
                textColor={textColor}
                mutedColor={mutedColor}
                tintColor={colors.tint}
                loading={deliveryStatusMutation.isPending}
                disabled={sale.status !== 'completed'}
              />
            </DetailRow>
          </DetailCard>
          {sale.items && sale.items.length > 0 ? (
            <DetailCard>
              <Text style={[styles.section, { color: textColor }]}>Items</Text>
              {sale.items.map((item, i) => {
                const imageUri = getSaleItemImageUrl(item);
                const displayName = item.name || item.product?.name || 'Product';
                return (
                  <View key={item.id ?? i} style={styles.itemRow}>
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
            </DetailCard>
          ) : null}
          {showPaymentForm && canRecordPayment ? (
            <DetailCard>
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
            </DetailCard>
          ) : null}
        </ScrollView>
        <DetailFooter>
          {showPaymentForm ? (
            <>
              <DetailActionButton label="Back" onPress={() => setShowPaymentForm(false)} />
              <DetailActionButton label="Record" variant="primary" loading={actionLoading} onPress={handleRecordPayment} />
            </>
          ) : (
            <>
              <DetailActionButton label="Receipt" icon="share" onPress={handleShareReceipt} loading={actionLoading} />
              {canRecordPayment ? (
                <DetailActionButton
                  label="Pay"
                  variant="primary"
                  onPress={() => {
                    setPaymentAmount(balance.toFixed(2));
                    setShowPaymentForm(true);
                  }}
                />
              ) : null}
              {sale.status !== 'cancelled' && sale.status !== 'refunded' ? (
                <DetailActionButton label="Cancel" variant="danger" loading={cancelLoading} onPress={handleCancelSale} />
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
