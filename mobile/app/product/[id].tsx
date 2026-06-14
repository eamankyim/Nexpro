import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { AppIcon } from '@/components/AppIcon';
import { FormSheetModal } from '@/components/FormSheetModal';
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
import { FORM_LABELS } from '@/constants/formLabels';
import { useCart } from '@/context/CartContext';
import { productService } from '@/services/productService';
import { resolveImageUrl } from '@/utils/fileUtils';
import { formatCurrency } from '@/utils/formatCurrency';
import { getApiErrorMessage, parseApiEntity } from '@/utils/parseApiListResponse';
import { refreshAfterInventoryChange } from '@/utils/queryInvalidation';
import { getOutOfStockMessage, isProductOutOfStock } from '@/utils/productStock';

type ProductDetail = {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  barcodes?: Array<{ id?: string; barcode?: string; isActive?: boolean }>;
  sellingPrice: number;
  costPrice?: number;
  quantityOnHand?: number;
  trackStock?: boolean;
  imageUrl?: string | null;
  category?: { id: string; name: string };
  isActive?: boolean;
};

const getAlternateBarcode = (product?: ProductDetail | null) => {
  if (!product?.barcodes?.length) return '';
  const primaryBarcode = product.barcode?.trim();
  return (
    product.barcodes.find((item) => {
      const barcode = item.barcode?.trim();
      return barcode && item.isActive !== false && barcode !== primaryBarcode;
    })?.barcode?.trim() || ''
  );
};

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addItem } = useCart();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor } = useEntityDetailTheme();
  const inputBg = bg === '#f9fafb' ? '#f9fafb' : '#18181b';

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    alternateBarcode: '',
    sellingPrice: '',
    costPrice: '',
    quantityOnHand: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productService.getProductById(String(id)),
    enabled: !!id,
  });

  const product = useMemo(() => parseApiEntity<ProductDetail>(data), [data]);

  const openEdit = useCallback(() => {
    if (!product) return;
    setEditForm({
      name: product.name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      alternateBarcode: getAlternateBarcode(product),
      sellingPrice: product.sellingPrice?.toString() || '',
      costPrice: product.costPrice?.toString() || '',
      quantityOnHand: product.quantityOnHand?.toString() || '',
    });
    setEditOpen(true);
  }, [product]);

  const updateMutation = useMutation({
    mutationFn: () =>
      productService.updateProduct(String(id), {
        name: editForm.name.trim(),
        sku: editForm.sku.trim() || undefined,
        barcode: editForm.barcode.trim() || undefined,
        barcodeAliases: editForm.alternateBarcode.trim() ? [editForm.alternateBarcode.trim()] : [],
        sellingPrice: parseFloat(editForm.sellingPrice),
        costPrice: editForm.costPrice ? parseFloat(editForm.costPrice) : undefined,
        quantityOnHand: editForm.quantityOnHand ? parseFloat(editForm.quantityOnHand) : undefined,
      }),
    onSuccess: async () => {
      await refreshAfterInventoryChange(queryClient);
      setEditOpen(false);
      Alert.alert('Success', 'Product updated successfully');
    },
    onError: (err: unknown) => {
      Alert.alert('Error', getApiErrorMessage(err, 'Failed to update product'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => productService.deleteProduct(String(id)),
    onSuccess: async () => {
      await refreshAfterInventoryChange(queryClient);
      router.back();
      Alert.alert('Success', 'Product deleted successfully');
    },
    onError: (err: unknown) => {
      Alert.alert('Error', getApiErrorMessage(err, 'Failed to delete product'));
    },
  });

  const handleAddToCart = useCallback(() => {
    if (!product) return;
    if (isProductOutOfStock(product)) {
      Alert.alert('Out of stock', getOutOfStockMessage(product.name));
      return;
    }
    const added = addItem({
      id: product.id,
      name: product.name,
      sellingPrice: product.sellingPrice,
      imageUrl: product.imageUrl ?? undefined,
      sku: product.sku ?? undefined,
      barcode: product.barcode ?? undefined,
      productCode: getAlternateBarcode(product) || undefined,
      trackStock: product.trackStock,
      quantityOnHand: product.quantityOnHand,
    });
    if (!added) {
      Alert.alert('Out of stock', getOutOfStockMessage(product.name));
      return;
    }
    Alert.alert('Success', `${product.name} added to cart`);
  }, [addItem, product]);

  const handleSave = useCallback(() => {
    if (!editForm.name.trim()) {
      Alert.alert('Error', 'Product name is required');
      return;
    }
    if (!editForm.sellingPrice) {
      Alert.alert('Error', 'Selling price is required');
      return;
    }
    const primaryBarcode = editForm.barcode.trim();
    const alternateBarcode = editForm.alternateBarcode.trim();
    if (primaryBarcode && alternateBarcode && primaryBarcode === alternateBarcode) {
      Alert.alert('Error', 'Product code must be different from the primary barcode');
      return;
    }
    updateMutation.mutate();
  }, [editForm, updateMutation]);

  const handleDelete = useCallback(() => {
    if (!product) return;
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ]
    );
  }, [deleteMutation, product]);

  if (isLoading) return <DetailLoading title="Product" />;
  if (!product) return <DetailNotFound title="Product" entityLabel="Product" />;

  const stockColor =
    product.trackStock === false
      ? mutedColor
      : product.quantityOnHand === 0
        ? '#ef4444'
        : (product.quantityOnHand ?? 0) < 10
          ? '#f59e0b'
          : '#10b981';
  const outOfStock = isProductOutOfStock(product);
  const alternateBarcode = getAlternateBarcode(product);
  const productMoreActions: DetailMoreAction[] = [
    {
      key: 'edit',
      label: 'Edit',
      icon: 'edit',
      onPress: openEdit,
    },
  ];

  return (
    <>
      <EntityDetailHeader title={product.name || 'Product'} />
      <ScreenShell style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <DetailHeroCard
            eyebrow={product.sku || product.barcode || 'Product'}
            title={outOfStock ? 'Out of Stock' : product.isActive === false ? 'Inactive' : 'Available'}
            message={product.name}
            metricLabel="Selling Price"
            metricValue={formatCurrency(product.sellingPrice)}
            secondaryIcon="archive"
            secondaryLabel="Stock"
            secondaryValue={
              product.trackStock === false
                ? 'Made to order'
                : `${product.quantityOnHand ?? 0} Units`
            }
            showCheck={!outOfStock && product.isActive !== false}
          />

          {product.imageUrl ? (
            <DetailSectionCard title="Product Image" icon="image">
              <Image
                source={{ uri: resolveImageUrl(product.imageUrl) }}
                style={[styles.heroImage, { borderColor }]}
                contentFit="cover"
              />
            </DetailSectionCard>
          ) : null}

          <DetailSectionCard title="Product Details" icon="archive">
            <DetailInfoRow icon="archive" label="Name" value={product.name} />
            {product.sku ? <DetailInfoRow icon="tag" label="SKU" value={product.sku} /> : null}
            {product.barcode ? <DetailInfoRow icon="tag" label="Barcode" value={product.barcode} /> : null}
            {alternateBarcode ? <DetailInfoRow icon="tag" label="Product Code" value={alternateBarcode} /> : null}
            {product.costPrice != null ? (
              <DetailInfoRow icon="money" label="Cost Price" value={formatCurrency(product.costPrice)} />
            ) : null}
            <DetailInfoRow
              icon="money"
              label="Selling Price"
              value={formatCurrency(product.sellingPrice)}
              valueColor={colors.tint}
            />
            {(product.trackStock === false || product.quantityOnHand !== undefined) && (
              <DetailInfoRow icon="archive" label="Stock">
                <Text style={[styles.stockValue, { color: stockColor }]}>
                  {product.trackStock === false
                    ? 'Made to order'
                    : `${product.quantityOnHand} units`}
                </Text>
              </DetailInfoRow>
            )}
            {product.category ? (
              <DetailInfoRow icon="list" label="Category" value={product.category.name} />
            ) : null}
          </DetailSectionCard>
        </ScrollView>
        <DetailFooter>
          <DetailActionButton
            label={outOfStock ? 'Out of stock' : 'Add to Cart'}
            icon="shopping-cart"
            variant="primary"
            onPress={handleAddToCart}
            disabled={outOfStock}
          />
          <DetailMoreActions actions={productMoreActions} />
        </DetailFooter>
      </ScreenShell>

      <FormSheetModal
        visible={editOpen}
        title={FORM_LABELS.product.editTitle}
        onClose={() => setEditOpen(false)}
        cardBg={cardBg}
        borderColor={borderColor}
        textColor={textColor}
        mutedColor={mutedColor}
        footer={
          <View style={styles.editFooter}>
            <Pressable
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              style={[styles.editBtn, styles.deleteBtn, { borderColor: '#ef4444' }]}
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator color="#ef4444" />
              ) : (
                <Text style={styles.deleteText}>{FORM_LABELS.product.delete}</Text>
              )}
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={updateMutation.isPending}
              style={[styles.editBtn, { backgroundColor: colors.tint, borderColor: colors.tint }]}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>{FORM_LABELS.product.save}</Text>
              )}
            </Pressable>
          </View>
        }
      >
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.product.name}</Text>
          <TextInput
            style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
            value={editForm.name}
            onChangeText={(t) => setEditForm((p) => ({ ...p, name: t }))}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.product.sku}</Text>
          <TextInput
            style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
            value={editForm.sku}
            onChangeText={(t) => setEditForm((p) => ({ ...p, sku: t }))}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.product.barcode}</Text>
          <TextInput
            style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
            value={editForm.barcode}
            onChangeText={(t) => setEditForm((p) => ({ ...p, barcode: t }))}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.product.alternateBarcode}</Text>
          <TextInput
            style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
            value={editForm.alternateBarcode}
            onChangeText={(t) => setEditForm((p) => ({ ...p, alternateBarcode: t }))}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.product.costPrice}</Text>
          <TextInput
            style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
            value={editForm.costPrice}
            onChangeText={(t) => setEditForm((p) => ({ ...p, costPrice: t }))}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.product.sellingPrice}</Text>
          <TextInput
            style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
            value={editForm.sellingPrice}
            onChangeText={(t) => setEditForm((p) => ({ ...p, sellingPrice: t }))}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.product.quantityOnHand}</Text>
          <TextInput
            style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
            value={editForm.quantityOnHand}
            onChangeText={(t) => setEditForm((p) => ({ ...p, quantityOnHand: t }))}
            keyboardType="number-pad"
          />
        </View>
      </FormSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  heroImage: { width: '100%', height: 220, borderRadius: 12, marginBottom: 16 },
  stockValue: { fontSize: 16, fontWeight: '600' },
  editFooter: { flexDirection: 'row', gap: 10 },
  editBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: { backgroundColor: 'transparent' },
  deleteText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
});
