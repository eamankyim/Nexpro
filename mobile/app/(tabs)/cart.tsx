import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { customerService } from '@/services/customerService';
import { saleService } from '@/services/saleService';
import { CURRENCY } from '@/constants';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { resolveImageUrl } from '@/utils/fileUtils';

export default function CartScreen() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, clearCart, getTotal, getSubtotal, getItemCount } =
    useCart();
  const { activeTenantId } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const queryClient = useQueryClient();

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card' | 'credit'>(
    'cash'
  );
  const [amountTendered, setAmountTendered] = useState('');
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState('');

  const { data: customersResponse } = useQuery({
    queryKey: ['customers', 'list', activeTenantId],
    queryFn: () => customerService.getCustomers({ limit: 50 }),
    enabled: !!activeTenantId && customerModalVisible,
    staleTime: 5 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  const customers = (customersResponse?.data || []) as Array<{
    id: string;
    name: string;
    phone?: string;
    email?: string;
  }>;

  const createSaleMutation = useMutation({
    mutationFn: (payload: object) => saleService.createSale(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      clearCart();
      setPaymentModalVisible(false);
      Alert.alert('Success', 'Sale completed successfully!', [
        {
          text: 'OK',
          onPress: () => router.push('/(tabs)/sales'),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.message || 'Failed to complete sale');
    },
  });

  const handleCheckout = useCallback(() => {
    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to cart before checkout');
      return;
    }
    setPaymentModalVisible(true);
  }, [items]);

  const handleCompletePayment = useCallback(() => {
    if (!activeTenantId) {
      Alert.alert('Error', 'No active workspace');
      return;
    }

    const total = getTotal();
    const saleItems = items.map((item) => {
      const unitPrice = Number(item.unitPrice) || 0;
      return {
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity - (item.discount || 0),
        discount: item.discount || 0,
      };
    });

    const payload: any = {
      items: saleItems,
      total,
      subtotal: getSubtotal(),
      discount: getSubtotal() - total,
      paymentMethod,
      customerId: selectedCustomer?.id || null,
      status: paymentMethod === 'credit' ? 'pending' : 'completed',
    };

    if (paymentMethod === 'cash') {
      const tendered = parseFloat(amountTendered) || 0;
      if (tendered < total) {
        Alert.alert('Error', 'Amount tendered is less than total');
        return;
      }
      payload.amountPaid = tendered;
      payload.change = tendered - total;
    } else if (paymentMethod === 'mobile_money') {
      if (!mobileMoneyNumber.trim()) {
        Alert.alert('Error', 'Please enter mobile money number');
        return;
      }
      payload.mobileMoneyNumber = mobileMoneyNumber.trim();
      payload.amountPaid = total;
    } else if (paymentMethod === 'card') {
      payload.amountPaid = total;
    } else if (paymentMethod === 'credit') {
      payload.amountPaid = 0;
      payload.balance = total;
    }

    createSaleMutation.mutate(payload);
  }, [
    items,
    getTotal,
    getSubtotal,
    paymentMethod,
    amountTendered,
    mobileMoneyNumber,
    selectedCustomer,
    activeTenantId,
    createSaleMutation,
    clearCart,
  ]);

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.emptyContainer}>
          <FontAwesome name="shopping-cart" size={64} color={mutedColor} />
          <Text style={[styles.emptyTitle, { color: textColor }]}>Your cart is empty</Text>
          <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
            Add products from the scan screen
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/scan')}
            style={[styles.emptyButton, { backgroundColor: colors.tint }]}
          >
            <Text style={styles.emptyButtonText}>Start Shopping</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Customer Selection */}
        <Pressable
          onPress={() => setCustomerModalVisible(true)}
          style={[styles.customerCard, { backgroundColor: cardBg, borderColor }]}
        >
          <FontAwesome name="user" size={20} color={colors.tint} />
          <View style={styles.customerInfo}>
            <Text style={[styles.customerLabel, { color: mutedColor }]}>Customer</Text>
            <Text style={[styles.customerName, { color: textColor }]}>
              {selectedCustomer?.name || 'Walk-in Customer'}
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color={mutedColor} />
        </Pressable>

        {/* Cart Items */}
        <View style={styles.itemsContainer}>
          {items.map((item) => {
            const unitPrice = Number(item.unitPrice) || 0;
            const itemTotal = unitPrice * item.quantity - (item.discount || 0);
            return (
              <View key={item.id} style={[styles.cartItem, { backgroundColor: cardBg, borderColor }]}>
                {item.imageUrl && (
                  <Image
                    source={{ uri: resolveImageUrl(item.imageUrl) }}
                    style={styles.itemImage}
                    contentFit="cover"
                  />
                )}
                <View style={styles.itemDetails}>
                  <Text style={[styles.itemName, { color: textColor }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.itemPrice, { color: mutedColor }]}>
                    {CURRENCY.SYMBOL} {unitPrice.toFixed(CURRENCY.DECIMAL_PLACES)} × {item.quantity}
                  </Text>
                  {item.discount && item.discount > 0 && (
                    <Text style={[styles.itemDiscount, { color: '#16a34a' }]}>
                      Discount: -{CURRENCY.SYMBOL} {item.discount.toFixed(CURRENCY.DECIMAL_PLACES)}
                    </Text>
                  )}
                </View>
                <View style={styles.itemActions}>
                  <View style={styles.quantityControls}>
                    <Pressable
                      onPress={() => updateQuantity(item.id, item.quantity - 1)}
                      style={[styles.quantityBtn, { borderColor }]}
                    >
                      <FontAwesome name="minus" size={14} color={textColor} />
                    </Pressable>
                    <Text style={[styles.quantityText, { color: textColor }]}>{item.quantity}</Text>
                    <Pressable
                      onPress={() => updateQuantity(item.id, item.quantity + 1)}
                      style={[styles.quantityBtn, { borderColor }]}
                    >
                      <FontAwesome name="plus" size={14} color={textColor} />
                    </Pressable>
                  </View>
                  <Text style={[styles.itemTotal, { color: colors.tint }]}>
                    {CURRENCY.SYMBOL} {itemTotal.toFixed(CURRENCY.DECIMAL_PLACES)}
                  </Text>
                  <Pressable
                    onPress={() => removeItem(item.id)}
                    style={styles.removeBtn}
                  >
                    <FontAwesome name="trash" size={16} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View style={[styles.totalsCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: mutedColor }]}>Subtotal</Text>
            <Text style={[styles.totalValue, { color: textColor }]}>
              {CURRENCY.SYMBOL} {getSubtotal().toFixed(CURRENCY.DECIMAL_PLACES)}
            </Text>
          </View>
          {getSubtotal() - getTotal() > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: mutedColor }]}>Discount</Text>
              <Text style={[styles.totalValue, { color: '#16a34a' }]}>
                -{CURRENCY.SYMBOL} {(getSubtotal() - getTotal()).toFixed(CURRENCY.DECIMAL_PLACES)}
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={[styles.totalLabel, { color: textColor, fontSize: 18, fontWeight: '700' }]}>
              Total
            </Text>
            <Text style={[styles.totalValue, { color: colors.tint, fontSize: 20, fontWeight: '700' }]}>
              {CURRENCY.SYMBOL} {getTotal().toFixed(CURRENCY.DECIMAL_PLACES)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Checkout Button */}
      <View style={[styles.checkoutFooter, { backgroundColor: cardBg, borderTopColor: borderColor }]}>
        <Pressable
          onPress={handleCheckout}
          disabled={createSaleMutation.isPending}
          style={[styles.checkoutButton, { backgroundColor: colors.tint }]}
        >
          {createSaleMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <FontAwesome name="credit-card" size={20} color="#fff" />
              <Text style={styles.checkoutButtonText}>Checkout</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Customer Selection Modal */}
      <Modal
        visible={customerModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Select Customer</Text>
              <Pressable onPress={() => setCustomerModalVisible(false)}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <Pressable
                onPress={() => {
                  setSelectedCustomer(null);
                  setCustomerModalVisible(false);
                }}
                style={[styles.customerOption, { borderColor }]}
              >
                <Text style={[styles.customerOptionText, { color: textColor }]}>Walk-in Customer</Text>
              </Pressable>
              {customers.map((customer) => (
                <Pressable
                  key={customer.id}
                  onPress={() => {
                    setSelectedCustomer(customer);
                    setCustomerModalVisible(false);
                  }}
                  style={[styles.customerOption, { borderColor }]}
                >
                  <Text style={[styles.customerOptionText, { color: textColor }]}>{customer.name}</Text>
                  <Text style={[styles.customerOptionSubtext, { color: mutedColor }]}>
                    {customer.phone || customer.email}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg, maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Payment</Text>
              <Pressable onPress={() => setPaymentModalVisible(false)}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.paymentTotal, { color: colors.tint }]}>
                Total: {CURRENCY.SYMBOL} {getTotal().toFixed(CURRENCY.DECIMAL_PLACES)}
              </Text>

              {/* Payment Method Selection */}
              <View style={styles.paymentMethods}>
                {(['cash', 'mobile_money', 'card', 'credit'] as const).map((method) => (
                  <Pressable
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    style={[
                      styles.paymentMethodBtn,
                      { borderColor },
                      paymentMethod === method && { backgroundColor: colors.tint, borderColor: colors.tint },
                    ]}
                  >
                    <Text
                      style={[
                        styles.paymentMethodText,
                        { color: paymentMethod === method ? '#fff' : textColor },
                      ]}
                    >
                      {method === 'cash'
                        ? 'Cash'
                        : method === 'mobile_money'
                          ? 'Mobile Money'
                          : method === 'card'
                            ? 'Card'
                            : 'Credit'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Cash Payment */}
              {paymentMethod === 'cash' && (
                <View style={styles.paymentInput}>
                  <Text style={[styles.inputLabel, { color: mutedColor }]}>Amount Tendered</Text>
                  <TextInput
                    style={[styles.input, { color: textColor, borderColor }]}
                    placeholder="0.00"
                    placeholderTextColor={mutedColor}
                    value={amountTendered}
                    onChangeText={setAmountTendered}
                    keyboardType="decimal-pad"
                  />
                  {amountTendered && parseFloat(amountTendered) >= getTotal() && (
                    <Text style={[styles.changeText, { color: '#16a34a' }]}>
                      Change: {CURRENCY.SYMBOL}{' '}
                      {(parseFloat(amountTendered) - getTotal()).toFixed(CURRENCY.DECIMAL_PLACES)}
                    </Text>
                  )}
                </View>
              )}

              {/* Mobile Money */}
              {paymentMethod === 'mobile_money' && (
                <View style={styles.paymentInput}>
                  <Text style={[styles.inputLabel, { color: mutedColor }]}>Mobile Money Number</Text>
                  <TextInput
                    style={[styles.input, { color: textColor, borderColor }]}
                    placeholder="0XX XXX XXXX"
                    placeholderTextColor={mutedColor}
                    value={mobileMoneyNumber}
                    onChangeText={setMobileMoneyNumber}
                    keyboardType="phone-pad"
                  />
                </View>
              )}

              {/* Credit Note */}
              {paymentMethod === 'credit' && (
                <View style={styles.paymentNote}>
                  <FontAwesome name="info-circle" size={20} color={colors.tint} />
                  <Text style={[styles.noteText, { color: mutedColor }]}>
                    An invoice will be created for this sale. Payment can be made later.
                  </Text>
                </View>
              )}

              <Pressable
                onPress={handleCompletePayment}
                disabled={createSaleMutation.isPending}
                style={[styles.payButton, { backgroundColor: colors.tint }]}
              >
                {createSaleMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.payButtonText}>Complete Payment</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  emptyButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  customerInfo: { flex: 1 },
  customerLabel: { fontSize: 12, marginBottom: 2 },
  customerName: { fontSize: 16, fontWeight: '600' },
  itemsContainer: { gap: 12, marginBottom: 16 },
  cartItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  itemImage: { width: 60, height: 60, borderRadius: 8 },
  itemDetails: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  itemPrice: { fontSize: 14 },
  itemDiscount: { fontSize: 13, marginTop: 2 },
  itemActions: { alignItems: 'flex-end', gap: 8 },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: { fontSize: 16, fontWeight: '600', minWidth: 24, textAlign: 'center' },
  itemTotal: { fontSize: 16, fontWeight: '700' },
  removeBtn: { padding: 4 },
  totalsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalRowFinal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: { fontSize: 16 },
  totalValue: { fontSize: 16, fontWeight: '600' },
  checkoutFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  checkoutButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBody: { padding: 20 },
  customerOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  customerOptionText: { fontSize: 16, fontWeight: '600' },
  customerOptionSubtext: { fontSize: 14, marginTop: 4 },
  paymentTotal: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  paymentMethodBtn: {
    flex: 1,
    minWidth: '45%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  paymentMethodText: { fontSize: 14, fontWeight: '600' },
  paymentInput: { marginBottom: 24 },
  inputLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  changeText: { fontSize: 14, marginTop: 8, fontWeight: '600' },
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginBottom: 24,
  },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20 },
  payButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  payButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
