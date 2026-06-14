import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ReviewSnippet } from '@/components/ReviewSnippet';
import { PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { BRAND, GHANA_REGIONS, STORAGE_KEYS } from '@/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addressesApi, ordersApi, type DeliveryAddress } from '@/services/ordersApi';
import { formatCurrency } from '@/utils/format';
import { analytics } from '@/utils/analytics';

const FOOD_SHOP_TYPES = new Set(['restaurant', 'supermarket', 'convenience']);

export default function CheckoutScreen() {
  const { items, cartSummary } = useCart();
  const { isAuthenticated } = useAuth();
  const isFoodOrder = FOOD_SHOP_TYPES.has(cartSummary.store?.shopType || '');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>(() => {
    if (FOOD_SHOP_TYPES.has(cartSummary.store?.shopType || '')) {
      return cartSummary.store?.deliveryEnabled ? 'delivery' : 'pickup';
    }
    if (cartSummary.store?.pickupEnabled && !cartSummary.store?.deliveryEnabled) return 'pickup';
    return cartSummary.store?.deliveryEnabled ? 'delivery' : 'pickup';
  });
  const [address, setAddress] = useState<Partial<DeliveryAddress>>({
    recipientName: '',
    phone: '',
    line1: '',
    city: '',
    region: GHANA_REGIONS[0],
  });
  const [notes, setNotes] = useState('');
  const [saveAddress, setSaveAddress] = useState(false);

  const addressesQuery = useQuery({
    queryKey: ['addresses'],
    queryFn: () => addressesApi.list(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    analytics.track('checkout_start', { storeSlug: items[0]?.storeSlug || '' });
  }, [items]);

  useEffect(() => {
    const saved = (addressesQuery.data?.data as DeliveryAddress[]) || [];
    const defaultAddress = saved.find((entry) => entry.isDefault) || saved[0];
    if (defaultAddress) setAddress(defaultAddress);
  }, [addressesQuery.data]);

  useEffect(() => {
    if (isFoodOrder && cartSummary.store?.deliveryEnabled) {
      setFulfillment('delivery');
    }
  }, [isFoodOrder, cartSummary.store?.deliveryEnabled]);

  const previewPayload = useMemo(
    () => ({
      storeSlug: items[0]?.storeSlug || '',
      items: items.map((i) => ({ listingId: i.listingId, quantity: i.quantity })),
      fulfillmentMethod: fulfillment,
      deliveryAddress: fulfillment === 'delivery' ? address : undefined,
      notes,
    }),
    [items, fulfillment, address, notes],
  );

  const previewQuery = useQuery({
    queryKey: ['checkout-preview', previewPayload],
    queryFn: () => ordersApi.previewCheckout(previewPayload),
    enabled: items.length > 0 && isAuthenticated,
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (fulfillment === 'delivery') {
        const missing = ['recipientName', 'phone', 'line1', 'city']
          .some((key) => !String(address[key as keyof DeliveryAddress] || '').trim());
        if (missing) {
          throw new Error('Enter recipient name, phone, address line, and city before paying.');
        }
      }
      if (previewQuery.isError) {
        throw new Error('Fix the checkout issue shown above before paying.');
      }
      if (saveAddress && fulfillment === 'delivery' && !address.id) {
        await addressesApi.create({
          label: 'Delivery address',
          recipientName: String(address.recipientName || ''),
          phone: String(address.phone || ''),
          line1: String(address.line1 || ''),
          line2: String(address.line2 || ''),
          city: String(address.city || ''),
          region: String(address.region || GHANA_REGIONS[0]),
          isDefault: savedAddresses.length === 0,
        });
      }
      analytics.track('paystack_start', { storeSlug: items[0]?.storeSlug || '' });
      return ordersApi.initializePaystack(previewPayload);
    },
    onSuccess: (res) => {
      const url = res?.data?.authorization_url;
      const reference = res?.data?.reference;
      const orderId = res?.data?.order?.id;
      if (!url || !reference || !orderId) {
        Alert.alert('Payment error', 'Could not start Paystack checkout.');
        return;
      }
      router.push({ pathname: '/checkout/paystack', params: { url, reference, orderId } });
    },
    onError: (err: { message?: string }) => Alert.alert('Checkout failed', err.message || 'Try again'),
  });

  const preview = previewQuery.data?.data;
  const savedAddresses = (addressesQuery.data?.data as DeliveryAddress[]) || [];
  const previewError = previewQuery.error as { message?: string } | null;

  const requireAuth = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.checkoutIntent, '/checkout');
    router.push('/login');
  };

  if (items.length === 0) {
    return (
      <Screen style={styles.center}>
        <Text>Your cart is empty.</Text>
      </Screen>
    );
  }

  if (!isAuthenticated) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.authTitle}>Sign in to checkout</Text>
        <Text style={styles.authMessage}>We will bring you back here after login.</Text>
        <PrimaryButton label="Continue to sign in" onPress={requireAuth} />
      </Screen>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.store}>Ordering from {cartSummary.store?.displayName}</Text>
      <Text style={styles.hint}>
        {isFoodOrder
          ? 'Food orders are delivery-first when the store supports delivery.'
          : 'Your cart holds items from one store only. Choose delivery or pickup based on what this seller offers.'}
      </Text>

      <View style={styles.segment}>
        {(['pickup', 'delivery'] as const).map((method) => {
          const disabled = method === 'delivery'
            ? !cartSummary.store?.deliveryEnabled
            : cartSummary.store?.pickupEnabled === false;
          return (
            <Pressable
              key={method}
              style={[styles.segmentBtn, fulfillment === method && styles.segmentActive, disabled && styles.segmentDisabled]}
              onPress={() => !disabled && setFulfillment(method)}
              disabled={disabled}
            >
              <Text style={[styles.segmentText, fulfillment === method && styles.segmentTextActive]}>
                {method === 'pickup' ? 'Pickup' : 'Delivery'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {fulfillment === 'delivery' ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Delivery address</Text>
          {savedAddresses.length > 0 ? (
            savedAddresses.map((a) => (
              <Pressable
                key={a.id || `${a.line1}-${a.city}`}
                style={[styles.addressCard, address.line1 === a.line1 && styles.addressCardActive]}
                onPress={() => setAddress(a)}
              >
                <Text style={styles.addressName}>{a.recipientName}</Text>
                <Text style={styles.addressLine}>{a.line1}, {a.city}</Text>
              </Pressable>
            ))
          ) : null}
          {(['recipientName', 'phone', 'line1', 'city'] as const).map((key) => (
            <TextInput
              key={key}
              style={styles.input}
              placeholder={key}
              value={String(address[key] || '')}
              onChangeText={(v) => setAddress((prev) => ({ ...prev, [key]: v }))}
            />
          ))}
          <Text style={styles.blockTitle}>Region (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionRow}>
            {GHANA_REGIONS.map((region) => (
              <Pressable
                key={region}
                style={[styles.regionChip, address.region === region && styles.regionChipActive]}
                onPress={() => setAddress((prev) => ({ ...prev, region }))}
              >
                <Text style={[styles.regionText, address.region === region && styles.regionTextActive]}>{region}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {!address.id ? (
            <Pressable style={styles.checkboxRow} onPress={() => setSaveAddress((value) => !value)}>
              <View style={[styles.checkbox, saveAddress && styles.checkboxActive]} />
              <Text style={styles.checkboxText}>Save this address for next time</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Order notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Delivery instructions or seller notes"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>

      {preview ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Order summary</Text>
          {preview.items.map((item) => (
            <Text key={item.listingId} style={styles.row}>
              {item.quantity} × {item.title} — {formatCurrency(item.subtotal, preview.currency)}
            </Text>
          ))}
          <Text style={styles.row}>Subtotal: {formatCurrency(preview.subtotal, preview.currency)}</Text>
          <Text style={styles.row}>
            Delivery: {preview.deliveryFeeWaived ? 'Free' : formatCurrency(preview.deliveryFee, preview.currency)}
          </Text>
          {preview.freeDeliveryThreshold ? (
            <Text style={styles.deliveryHint}>
              Free delivery on orders over {formatCurrency(preview.freeDeliveryThreshold, preview.currency)}
            </Text>
          ) : null}
          <Text style={styles.total}>Paystack total: {formatCurrency(preview.total, preview.currency)}</Text>
        </View>
      ) : null}

      {previewQuery.isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Checkout needs attention</Text>
          <Text style={styles.errorText}>{previewError?.message || 'Could not calculate checkout totals.'}</Text>
        </View>
      ) : null}

      <PrimaryButton
        label="Pay with Paystack"
        onPress={() => payMutation.mutate()}
        disabled={previewQuery.isError || !preview}
        loading={payMutation.isPending || previewQuery.isFetching}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  authTitle: { fontSize: 20, fontWeight: '800', color: BRAND.text },
  authMessage: { color: BRAND.muted, textAlign: 'center' },
  content: { padding: 16, gap: 12 },
  store: { fontWeight: '700', color: BRAND.text },
  hint: { color: BRAND.muted, lineHeight: 20 },
  deliveryHint: { color: BRAND.primary, fontSize: 12, marginTop: 4 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: BRAND.primary, borderColor: BRAND.primary },
  segmentDisabled: { opacity: 0.45 },
  segmentText: { fontWeight: '600', color: BRAND.text },
  segmentTextActive: { color: '#fff' },
  block: { gap: 8 },
  blockTitle: { fontWeight: '700', color: BRAND.text },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    padding: 12,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  regionRow: { gap: 8, paddingVertical: 2 },
  regionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  regionChipActive: { backgroundColor: BRAND.primary, borderColor: BRAND.primary },
  regionText: { color: BRAND.text, fontWeight: '700' },
  regionTextActive: { color: '#fff' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: BRAND.border, backgroundColor: '#fff' },
  checkboxActive: { backgroundColor: BRAND.primary, borderColor: BRAND.primary },
  checkboxText: { color: BRAND.text, fontWeight: '600' },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  addressCardActive: { borderColor: BRAND.primary, backgroundColor: '#f0fdf4' },
  addressName: { fontWeight: '700' },
  addressLine: { color: BRAND.muted, marginTop: 4 },
  summary: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: BRAND.border, gap: 4 },
  summaryTitle: { fontWeight: '800', marginBottom: 4, color: BRAND.text },
  row: { color: BRAND.muted, marginBottom: 4 },
  total: { marginTop: 8, fontWeight: '800', fontSize: 18, color: BRAND.text },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  errorTitle: { color: BRAND.danger, fontWeight: '800' },
  errorText: { color: BRAND.danger, lineHeight: 20 },
});
