import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { AppIcon } from '@/components/AppIcon';
import {
  DetailActionButton,
  DetailFooter,
  DetailLoading,
  DetailMoreActions,
  DetailNotFound,
  EntityDetailHeader,
  type DetailMoreAction,
} from '@/components/EntityDetailLayout';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/context/AuthContext';
import { useExclusiveAction } from '@/hooks/useExclusiveAction';
import { useScreenColors } from '@/hooks/useScreenColors';
import { shareReceiptPdf } from '@/services/pdfDocumentService';
import { saleService } from '@/services/saleService';
import { storeService } from '@/services/storeService';
import { formatCurrency } from '@/utils/formatCurrency';
import { resolveImageUrl } from '@/utils/fileUtils';
import { getApiErrorMessage, parseApiEntity } from '@/utils/parseApiListResponse';
import { refreshAfterOnlineOrderChange } from '@/utils/queryInvalidation';
import { getCountryCallingCodeFromPhone, openWhatsAppChat } from '@/utils/whatsapp';
import {
  canApplyOnlineOrderStatus,
  canShowSellerRefund,
  formatOnlineOrderStatusLabel,
  fulfillmentStateForOrder,
  getCustomerName,
  getOnlineOrderStatusColors,
  getOrderNumber,
  getOrderTotal,
  ONLINE_ORDER_STATUS_ACTIONS,
  paymentStatusForMarketplaceOrder,
} from '@/utils/marketplaceOrderStatus';

function getOrderItems(order: Record<string, unknown>) {
  const items =
    order.items
    || order.orderItems
    || order.saleItems
    || order.lineItems
    || order.products
    || [];
  return Array.isArray(items) ? items : [];
}

function getItemName(item: Record<string, unknown>): string {
  const product = item.product && typeof item.product === 'object'
    ? (item.product as Record<string, unknown>)
    : {};
  return (
    (item.name as string)
    || (item.productName as string)
    || (product.name as string)
    || (item.title as string)
    || 'Item'
  );
}

function getDeliveryAddress(order: Record<string, unknown>): string {
  const metadata = order.metadata && typeof order.metadata === 'object'
    ? (order.metadata as Record<string, unknown>)
    : {};
  const address = order.deliveryAddress || metadata.deliveryAddress;
  if (typeof address === 'string') return address;
  if (address && typeof address === 'object') {
    const a = address as Record<string, unknown>;
    return [
      a.addressLine1,
      a.addressLine2,
      a.street,
      a.city,
      a.region,
      a.country,
    ]
      .filter(Boolean)
      .join(', ');
  }
  return (order.deliveryAddressText as string) || '';
}

function getCustomerPhone(order: Record<string, unknown>): string {
  const customer = order.customer && typeof order.customer === 'object'
    ? (order.customer as Record<string, unknown>)
    : {};
  return (
    (order.customerPhone as string)
    || (order.phone as string)
    || (customer.phone as string)
    || ''
  );
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function titleCase(value: unknown): string {
  const text = String(value || '').replace(/[_-]+/g, ' ').trim();
  if (!text) return 'Not specified';
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getNestedObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getItemImageUrl(item: Record<string, unknown>): string {
  const product = getNestedObject(item.product);
  const metadata = getNestedObject(item.metadata);
  const raw = (item.imageUrl as string) || (metadata.imageUrl as string) || (product.imageUrl as string) || '';
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed.startsWith('undefined')) return '';
  return resolveImageUrl(trimmed);
}

function getItemQuantity(item: Record<string, unknown>): number {
  return numberValue(item.quantity ?? item.qty, 1);
}

function getItemUnitPrice(item: Record<string, unknown>): number {
  const qty = getItemQuantity(item) || 1;
  return numberValue(
    item.unitPrice ?? item.price ?? item.rate ?? item.salePrice,
    numberValue(item.total ?? item.lineTotal ?? item.totalPrice, 0) / qty
  );
}

function getItemLineTotal(item: Record<string, unknown>): number {
  const fallback = getItemQuantity(item) * getItemUnitPrice(item);
  return numberValue(item.total ?? item.lineTotal ?? item.totalPrice ?? item.subtotal, fallback);
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function getDeliveryFee(order: Record<string, unknown>): number {
  const metadata = getNestedObject(order.metadata);
  return numberValue(order.deliveryFee ?? metadata.deliveryFee, 0);
}

function getOrderSubtotal(order: Record<string, unknown>, items: Record<string, unknown>[]): number {
  const deliveryFee = getDeliveryFee(order);
  const itemSubtotal = items.reduce((sum, item) => sum + getItemLineTotal(item), 0);
  return numberValue(order.subtotal ?? order.subTotal, itemSubtotal || Math.max(0, getOrderTotal(order) - deliveryFee));
}

function getPaymentMethod(order: Record<string, unknown>): string {
  const metadata = getNestedObject(order.metadata);
  const marketplacePayment = getNestedObject(order.marketplacePayment);
  return titleCase(
    order.paymentMethod
      ?? marketplacePayment.paymentMethod
      ?? marketplacePayment.channel
      ?? metadata.paymentMethod
      ?? 'Mobile Money'
  );
}

function getStatusMessage(status: string): string {
  switch (status) {
    case 'delivered':
      return 'Thank you! Your order has been delivered.';
    case 'out_for_delivery':
      return 'Your order is on the way to the customer.';
    case 'ready':
      return 'This order is packed and ready for delivery.';
    case 'processing':
      return 'This order is being prepared.';
    case 'cancelled':
      return 'This order has been cancelled.';
    default:
      return 'This online order is ready for your attention.';
  }
}

function isPaidPaymentStatus(status: string | null): boolean {
  return ['paid', 'paid_held', 'held', 'released', 'completed'].includes(String(status || '').toLowerCase());
}

type StoreOrderAction = 'refund' | 'receipt' | 'whatsapp' | `status:${string}`;

export default function StoreOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeTenant } = useAuth();
  const { colors, cardBg, borderColor, textColor, mutedColor, inputBg } = useScreenColors();
  const [statusOpen, setStatusOpen] = useState(false);
  const { isAnyActionActive, isActionActive, runExclusiveAction } = useExclusiveAction<StoreOrderAction>();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['store', 'order', id],
    queryFn: () => storeService.getOrderById(String(id)),
    enabled: !!id,
  });

  const order = useMemo(() => {
    const entity = parseApiEntity<Record<string, unknown>>(data);
    return entity;
  }, [data]);

  const statusMutation = useMutation({
    mutationFn: (status: string) => storeService.updateOrderStatus(String(id), status),
    onSuccess: async () => {
      await refreshAfterOnlineOrderChange(queryClient);
      setStatusOpen(false);
      refetch();
    },
    onError: (e: unknown) => {
      Alert.alert('Update failed', getApiErrorMessage(e, 'Could not update order status'));
    },
  });

  const refundMutation = useMutation({
    mutationFn: () => storeService.refundTradeAssuranceOrder(String(id)),
    onSuccess: async () => {
      await refreshAfterOnlineOrderChange(queryClient);
      refetch();
      Alert.alert('Refund started', 'The refund has been submitted.');
    },
    onError: (e: unknown) => {
      Alert.alert('Refund failed', getApiErrorMessage(e, 'Could not process refund'));
    },
  });

  const handleRefund = useCallback(() => {
    Alert.alert(
      'Refund order',
      'Refund the order payment? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund',
          style: 'destructive',
          onPress: () => {
            runExclusiveAction('refund', () => refundMutation.mutateAsync());
          },
        },
      ]
    );
  }, [refundMutation, runExclusiveAction]);

  const handleWhatsApp = useCallback(async () => {
    if (!order) return;
    await runExclusiveAction('whatsapp', async () => {
      const customerName = getCustomerName(order);
      const orderNo = getOrderNumber(order);
      const message = `Hi ${customerName}, thanks for your online order ${orderNo}. We are following up on it.`;
      await openWhatsAppChat({
        phone: getCustomerPhone(order),
        message,
        contactLabel: customerName,
        defaultCountryCode: getCountryCallingCodeFromPhone(activeTenant?.metadata?.phone),
      });
    });
  }, [activeTenant?.metadata?.phone, order, runExclusiveAction]);

  const handleDownloadReceipt = useCallback(async () => {
    if (!order) return;
    await runExclusiveAction('receipt', async () => {
      try {
        let orderForReceipt = order;
        try {
          const res = await saleService.getReceipt(String(order.id || id));
          const full = (res as { data?: unknown })?.data ?? res;
          if (full && typeof full === 'object') {
            orderForReceipt = full as Record<string, unknown>;
          }
        } catch {
          // Online orders are backed by sales, but keep the action useful if the receipt endpoint is unavailable.
        }

        const receiptItems = getOrderItems(orderForReceipt) as Record<string, unknown>[];
        await shareReceiptPdf({
          ...orderForReceipt,
          saleNumber: getOrderNumber(orderForReceipt),
          customer: getNestedObject(orderForReceipt.customer),
          shop: getNestedObject(orderForReceipt.shop),
          tenantName: activeTenant?.name,
          items: receiptItems.map((item) => ({
            name: getItemName(item),
            quantity: getItemQuantity(item),
            unitPrice: getItemUnitPrice(item),
            total: getItemLineTotal(item),
            product: getNestedObject(item.product),
          })),
          subtotal: getOrderSubtotal(orderForReceipt, receiptItems),
          total: getOrderTotal(orderForReceipt),
          amountPaid: isPaidPaymentStatus(paymentStatusForMarketplaceOrder(orderForReceipt))
            ? getOrderTotal(orderForReceipt)
            : numberValue(orderForReceipt.amountPaid),
          paymentMethod: getPaymentMethod(orderForReceipt),
        });
      } catch (err: unknown) {
        Alert.alert('Receipt unavailable', err instanceof Error ? err.message : 'Could not prepare this order receipt PDF.');
      }
    });
  }, [activeTenant?.name, id, order, runExclusiveAction]);

  const handleStatusUpdate = useCallback(
    (status: string) => {
      runExclusiveAction(`status:${status}`, () => statusMutation.mutateAsync(status));
    },
    [runExclusiveAction, statusMutation]
  );

  if (isLoading) return <DetailLoading title="Online order" />;
  if (!order) return <DetailNotFound title="Online order" entityLabel="Order" />;

  const fulfillment = fulfillmentStateForOrder(order);
  const paymentStatus = paymentStatusForMarketplaceOrder(order);
  const paymentColors = paymentStatus ? getOnlineOrderStatusColors(paymentStatus) : null;
  const items = getOrderItems(order) as Record<string, unknown>[];
  const orderNumber = getOrderNumber(order);
  const total = getOrderTotal(order);
  const subtotal = getOrderSubtotal(order, items);
  const deliveryFee = getDeliveryFee(order);
  const customerPhone = getCustomerPhone(order);
  const deliveryAddress = getDeliveryAddress(order);
  const paid = isPaidPaymentStatus(paymentStatus);
  const availableActions = ONLINE_ORDER_STATUS_ACTIONS.filter((action) =>
    canApplyOnlineOrderStatus(order, action.value)
  );
  const canRefund = canShowSellerRefund(order) && fulfillment !== 'cancelled';
  const storeOrderMoreActions: DetailMoreAction[] = [
    {
      key: 'receipt',
      label: 'Download Receipt',
      icon: 'download',
      onPress: handleDownloadReceipt,
      loading: isActionActive('receipt'),
      disabled: isAnyActionActive,
    },
    ...(availableActions.length > 0
      ? [{
          key: 'status',
          label: 'Update status',
          icon: 'refresh' as const,
          onPress: () => setStatusOpen(true),
          disabled: isAnyActionActive,
        }]
      : []),
    ...(canRefund
      ? [{
          key: 'refund',
          label: 'Refund',
          icon: 'minus-circle' as const,
          variant: 'danger' as const,
          onPress: handleRefund,
          loading: isActionActive('refund'),
          disabled: isAnyActionActive,
        }]
      : []),
  ];

  return (
    <>
      <EntityDetailHeader title="Order Details" />
      <ScreenShell style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroDecorOne} />
          <View style={styles.heroDecorTwo} />
          <View style={styles.heroTopRow}>
            <View style={styles.orderNumberPill}>
              <Text style={styles.orderNumberPillText}>{orderNumber}</Text>
            </View>
          </View>
          <View style={styles.heroStatusRow}>
            <Text style={styles.heroStatus}>{formatOnlineOrderStatusLabel(fulfillment, 'fulfillment')}</Text>
            <View style={styles.heroCheckInline}>
              <AppIcon name="check" size={14} color="#047857" strokeWidth={3} />
            </View>
          </View>
          <Text style={styles.heroMessage}>{getStatusMessage(fulfillment)}</Text>
          <View style={styles.heroDivider} />
          <View style={styles.heroMetrics}>
            <View style={styles.heroMetricBlock}>
              <Text style={styles.heroMetricLabel}>Total Amount</Text>
              <Text style={styles.heroAmount}>{formatCurrency(total)}</Text>
            </View>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroItemsBlock}>
              <AppIcon name="archive" size={18} color="#d1fae5" />
              <Text style={styles.heroItemsText}>
                {items.length} {items.length === 1 ? 'Item' : 'Items'}
              </Text>
            </View>
          </View>
        </View>

        {items.length > 0 ? (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Order Items</Text>
            {items.map((item, index) => {
              const qty = getItemQuantity(item);
              const unitPrice = getItemUnitPrice(item);
              const lineTotal = getItemLineTotal(item);
              const imageUrl = getItemImageUrl(item);
              return (
                <View
                  key={String(item.id || index)}
                  style={[styles.itemRow, index > 0 && { borderTopWidth: 1, borderTopColor: borderColor }]}
                >
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={[styles.itemImage, { borderColor }]} contentFit="cover" />
                  ) : (
                    <View style={[styles.itemImagePlaceholder, { borderColor, backgroundColor: inputBg }]}>
                      <AppIcon name="archive" size={20} color={mutedColor} />
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: textColor }]} numberOfLines={2}>
                      {getItemName(item)}
                    </Text>
                    <Text style={[styles.itemMeta, { color: mutedColor }]}>
                      <Text style={{ color: colors.tint, fontWeight: '700' }}>Qty: {formatQuantity(qty)}</Text>
                      {'  ×  '}
                      {formatCurrency(unitPrice)}
                    </Text>
                  </View>
                  <Text style={[styles.itemTotal, { color: textColor }]}>{formatCurrency(lineTotal)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.cardHeadingRow}>
            <View style={[styles.iconBadge, { backgroundColor: '#dcfce7' }]}>
              <AppIcon name="user" size={18} color={colors.tint} />
            </View>
            <Text style={[styles.cardHeading, { color: textColor }]}>Customer & Delivery</Text>
          </View>
          <Text style={[styles.customerName, { color: textColor }]}>{getCustomerName(order)}</Text>
          {customerPhone ? (
            <View style={styles.infoRow}>
              <AppIcon name="phone" size={16} color={colors.tint} />
              <Text style={[styles.infoText, { color: textColor }]}>{customerPhone}</Text>
            </View>
          ) : null}
          {deliveryAddress ? (
            <View style={styles.infoRow}>
              <AppIcon name="map-pin" size={16} color={colors.tint} />
              <Text style={[styles.infoText, { color: textColor }]}>{deliveryAddress}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, styles.compactCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.paymentRow}>
            <View style={styles.cardHeadingRow}>
              <View style={[styles.iconBadge, { backgroundColor: '#dcfce7' }]}>
                <AppIcon name="credit-card" size={18} color={colors.tint} />
              </View>
              <View>
                <Text style={[styles.cardHeading, { color: textColor }]}>Payment</Text>
                <View style={styles.paymentMetaRow}>
                  <Text style={[styles.infoText, { color: textColor }]}>{getPaymentMethod(order)}</Text>
                  {paymentStatus && paymentColors ? (
                    <View style={[styles.paidBadge, { backgroundColor: paymentColors.bg, borderColor: paymentColors.border }]}>
                      <Text style={[styles.paidBadgeText, { color: paymentColors.text }]}>
                        {paid ? 'Paid' : formatOnlineOrderStatusLabel(paymentStatus, 'payment')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
            <Text style={[styles.paymentAmount, { color: textColor }]}>{formatCurrency(total)}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.cardHeadingRow}>
            <View style={[styles.iconBadge, { backgroundColor: '#dcfce7' }]}>
              <AppIcon name="receipt" size={18} color={colors.tint} />
            </View>
            <Text style={[styles.cardHeading, { color: textColor }]}>Order Summary</Text>
          </View>
          <View style={styles.summaryRows}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: mutedColor }]}>Subtotal</Text>
              <Text style={[styles.summaryValue, { color: textColor }]}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: mutedColor }]}>Delivery Fee</Text>
              <Text style={[styles.summaryValue, { color: textColor }]}>{formatCurrency(deliveryFee)}</Text>
            </View>
          </View>
          <View style={[styles.summaryTotalRow, { borderTopColor: borderColor }]}>
            <Text style={[styles.summaryTotalLabel, { color: colors.tint }]}>Total Amount</Text>
            <Text style={[styles.summaryTotalValue, { color: colors.tint }]}>{formatCurrency(total)}</Text>
          </View>
        </View>
        </ScrollView>
        <DetailFooter>
          <DetailActionButton
            label="WhatsApp"
            icon="comments"
            variant="primary"
            onPress={handleWhatsApp}
            loading={isActionActive('whatsapp')}
            disabled={isAnyActionActive}
          />
          <DetailMoreActions actions={storeOrderMoreActions} disabled={isAnyActionActive} />
        </DetailFooter>
      </ScreenShell>

      <Modal visible={statusOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => !isAnyActionActive && setStatusOpen(false)}>
          <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Update order status</Text>
            {availableActions.map((action) => {
              const actionKey: StoreOrderAction = `status:${action.value}`;
              return (
                <Pressable
                  key={action.value}
                  onPress={() => handleStatusUpdate(action.value)}
                  disabled={isAnyActionActive}
                  style={[styles.modalRow, { borderBottomColor: borderColor }]}
                >
                  <Text style={{ color: textColor, fontSize: 16 }}>{action.label}</Text>
                  {isActionActive(actionKey) ? (
                    <ActivityIndicator size="small" color={colors.tint} />
                  ) : (
                    <AppIcon name="chevron-right" size={14} color={mutedColor} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#047857',
    borderColor: '#059669',
    borderWidth: 1,
    borderRadius: 14,
    padding: 22,
    marginBottom: 16,
    minHeight: 208,
  },
  heroDecorOne: {
    position: 'absolute',
    right: 28,
    top: 18,
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 12,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroDecorTwo: {
    position: 'absolute',
    right: -30,
    bottom: -34,
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumberPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  orderNumberPillText: { color: '#d1fae5', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  heroStatus: { color: '#fff', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  heroCheckInline: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  heroMessage: { color: '#d1fae5', fontSize: 13, fontWeight: '600', marginTop: 8 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 18, marginBottom: 14 },
  heroMetrics: { flexDirection: 'row', alignItems: 'center' },
  heroMetricBlock: { flex: 1 },
  heroMetricLabel: { color: '#d1fae5', fontSize: 12, fontWeight: '700', marginBottom: 5 },
  heroAmount: { color: '#fff', fontSize: 30, lineHeight: 36, fontWeight: '800' },
  heroMetricDivider: { width: 1, height: 54, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 22 },
  heroItemsBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroItemsText: { color: '#d1fae5', fontSize: 14, fontWeight: '800' },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  compactCard: { paddingVertical: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  itemImage: { width: 58, height: 58, borderRadius: 10, borderWidth: 1 },
  itemImagePlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1, gap: 7 },
  itemName: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  itemMeta: { fontSize: 13, fontWeight: '600' },
  itemTotal: { fontSize: 15, fontWeight: '800' },
  cardHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeading: { fontSize: 14, fontWeight: '800' },
  customerName: { fontSize: 16, fontWeight: '800', marginTop: 16, marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  infoText: { flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  paymentMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  paidBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  paidBadgeText: { fontSize: 11, fontWeight: '800' },
  paymentAmount: { fontSize: 16, fontWeight: '800' },
  summaryRows: { marginTop: 18, gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 14, fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  summaryTotalRow: {
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  summaryTotalLabel: { fontSize: 15, fontWeight: '800' },
  summaryTotalValue: { fontSize: 22, fontWeight: '800' },
  managementActions: { marginTop: 2, marginBottom: 16 },
  managementTitle: { fontSize: 12, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600' },
  bottomActions: { flexDirection: 'row', gap: 12, marginTop: 2 },
  primaryAction: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  primaryActionText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  outlineAction: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: 'transparent',
  },
  outlineActionText: { fontSize: 15, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 12, borderWidth: 1, padding: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', padding: 12 },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
});
