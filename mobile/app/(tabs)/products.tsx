import React, { useState, useCallback, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { productService } from '@/services/productService';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useCart } from '@/context/CartContext';
import Colors from '@/constants/Colors';
import { CURRENCY } from '@/constants';
import { resolveImageUrl } from '@/utils/fileUtils';
import { useRouter } from 'expo-router';

function formatCurrency(value: number | string | null | undefined): string {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value ?? 0)) || 0;
  return `${CURRENCY.SYMBOL} ${numValue.toFixed(CURRENCY.DECIMAL_PLACES)}`;
}

type Product = {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  sellingPrice: number;
  costPrice?: number;
  quantityOnHand?: number;
  trackStock?: boolean;
  imageUrl?: string | null;
  category?: { id: string; name: string };
  isActive?: boolean;
};

export default function ProductsScreen() {
  const params = useLocalSearchParams<{ search?: string; add?: string }>();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme];
  const queryClient = useQueryClient();
  const { activeTenant, activeTenantId } = useAuth();
  const { addItem } = useCart();

  const [searchText, setSearchText] = useState(params.search ?? '');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(params.add === '1');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    sellingPrice: '',
    costPrice: '',
    quantityOnHand: '',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    sellingPrice: '',
    costPrice: '',
    quantityOnHand: '',
  });

  useEffect(() => {
    if (params.search) setSearchText(params.search);
    if (params.add === '1') setAddModalVisible(true);
  }, [params.search, params.add]);

  const debouncedSearch = useDebounce(searchText, 400);

  const { data: response, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['products', activeTenantId, debouncedSearch],
    queryFn: () =>
      productService.getProducts({
        page: 1,
        limit: 20,
        search: debouncedSearch || undefined,
        isActive: true,
      }),
    enabled: !!activeTenantId,
    staleTime: 3 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      sku?: string;
      barcode?: string;
      sellingPrice: number;
      costPrice?: number;
      quantityOnHand?: number;
    }) => {
      // Use the API directly since productService doesn't have create method yet
      const { api } = await import('@/services/api');
      const res = await api.post('/products', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setAddModalVisible(false);
      setFormData({ name: '', sku: '', barcode: '', sellingPrice: '', costPrice: '', quantityOnHand: '' });
      Alert.alert('Success', 'Product created successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to create product');
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: {
      name?: string;
      sku?: string;
      barcode?: string;
      sellingPrice?: number;
      costPrice?: number;
      quantityOnHand?: number;
      isActive?: boolean;
    }}) => {
      return productService.updateProduct(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setEditModalVisible(false);
      setSelectedProduct(null);
      setEditingProduct(null);
      setEditFormData({ name: '', sku: '', barcode: '', sellingPrice: '', costPrice: '', quantityOnHand: '' });
      Alert.alert('Success', 'Product updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to update product');
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      return productService.deleteProduct(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setEditModalVisible(false);
      setSelectedProduct(null);
      setEditingProduct(null);
      Alert.alert('Success', 'Product deleted successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to delete product');
    },
  });

  const products = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []) as Product[];
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const handleProductPress = useCallback((product: Product) => {
    setSelectedProduct(product);
  }, []);

  const handleAddToCart = useCallback((product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      sellingPrice: product.sellingPrice,
      imageUrl: product.imageUrl ?? undefined,
      sku: product.sku ?? undefined,
      barcode: product.barcode ?? undefined,
    });
    Alert.alert('Success', `${product.name} added to cart`);
    setSelectedProduct(null);
  }, [addItem]);

  const handleEditProduct = useCallback((product: Product) => {
    setEditingProduct(product);
    setEditFormData({
      name: product.name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      sellingPrice: product.sellingPrice?.toString() || '',
      costPrice: product.costPrice?.toString() || '',
      quantityOnHand: product.quantityOnHand?.toString() || '',
    });
    setSelectedProduct(null); // Close detail modal
    setEditModalVisible(true); // Open edit modal
  }, []);

  const handleUpdateProduct = useCallback(() => {
    if (!editingProduct) return;
    if (!editFormData.name.trim()) {
      Alert.alert('Error', 'Product name is required');
      return;
    }
    if (!editFormData.sellingPrice) {
      Alert.alert('Error', 'Selling price is required');
      return;
    }

    updateProductMutation.mutate({
      id: editingProduct.id,
      data: {
        name: editFormData.name.trim(),
        sku: editFormData.sku.trim() || undefined,
        barcode: editFormData.barcode.trim() || undefined,
        sellingPrice: parseFloat(editFormData.sellingPrice),
        costPrice: editFormData.costPrice ? parseFloat(editFormData.costPrice) : undefined,
        quantityOnHand: editFormData.quantityOnHand ? parseFloat(editFormData.quantityOnHand) : undefined,
      },
    });
  }, [editingProduct, editFormData, updateProductMutation]);

  const handleDeleteProduct = useCallback(() => {
    if (!editingProduct) return;
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${editingProduct.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteProductMutation.mutate(editingProduct.id),
        },
      ]
    );
  }, [editingProduct, deleteProductMutation]);

  const handleCreateProduct = useCallback(() => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Product name is required');
      return;
    }
    if (!formData.sellingPrice) {
      Alert.alert('Error', 'Selling price is required');
      return;
    }

    createProductMutation.mutate({
      name: formData.name.trim(),
      sku: formData.sku.trim() || undefined,
      barcode: formData.barcode.trim() || undefined,
      sellingPrice: parseFloat(formData.sellingPrice),
      costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
      quantityOnHand: formData.quantityOnHand ? parseFloat(formData.quantityOnHand) : undefined,
    });
  }, [formData, createProductMutation]);

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';
  const inputBg = resolvedTheme === 'dark' ? '#18181b' : '#f9fafb';

  const businessType = activeTenant?.businessType ?? 'shop';
  const isShop = businessType === 'shop';
  const isPharmacy = businessType === 'pharmacy';

  if (!isShop && !isPharmacy) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.emptyTitle, { color: textColor }]}>Products</Text>
        <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
          Products are available for shop and pharmacy businesses.
        </Text>
      </View>
    );
  }

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - 16 * 2 - 12) / 2; // padding + gap between cards

  const renderProductItem = ({ item }: { item: Product }) => {
    const imageUrl = item.imageUrl;
    const hasImage = imageUrl && 
                     typeof imageUrl === 'string' &&
                     imageUrl.trim() !== '' && 
                     imageUrl !== 'null' && 
                     imageUrl !== 'undefined' &&
                     !imageUrl.startsWith('undefined');
    
    return (
      <Pressable
        onPress={() => handleProductPress(item)}
        style={({ pressed }) => [
          styles.productCard,
          { width: cardWidth, backgroundColor: cardBg, borderColor },
          pressed && styles.pressed,
        ]}
      >
        {/* Image container - always visible */}
        <View style={styles.cardImageContainer}>
          {hasImage ? (
            <Image
              source={{ uri: resolveImageUrl(imageUrl) }}
              style={styles.cardImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.cardImagePlaceholder, { backgroundColor: inputBg }]}>
              <FontAwesome name="image" size={32} color={mutedColor} />
            </View>
          )}
          {item.trackStock === false ? (
            <View style={[styles.stockBadge, { backgroundColor: 'rgba(100,116,139,0.9)' }]}>
              <Text style={styles.stockBadgeText}>MTO</Text>
            </View>
          ) : item.quantityOnHand !== undefined && item.quantityOnHand !== null && (
            <View
              style={[
                styles.stockBadge,
                {
                  backgroundColor:
                    item.quantityOnHand === 0
                      ? 'rgba(239,68,68,0.9)'
                      : item.quantityOnHand < 10
                      ? 'rgba(245,158,11,0.9)'
                      : 'rgba(16,185,129,0.9)',
                },
              ]}
            >
              <Text style={styles.stockBadgeText}>{item.quantityOnHand}</Text>
            </View>
          )}
        </View>
        {/* Product info */}
        <View style={styles.cardContent}>
          <Text style={[styles.cardProductName, { color: textColor }]} numberOfLines={2}>
            {item.name || 'Unnamed Product'}
          </Text>
          {item.sku && (
            <Text style={[styles.cardSku, { color: mutedColor }]} numberOfLines={1}>
              {item.sku}
            </Text>
          )}
          <Text style={[styles.cardPrice, { color: colors.tint }]}>
            {formatCurrency(item.sellingPrice)}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Search bar */}
      <View style={[styles.searchContainer, { backgroundColor: cardBg, borderColor }]}>
        <FontAwesome name="search" size={16} color={mutedColor} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: textColor }]}
          placeholder="Search products..."
          placeholderTextColor={mutedColor}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <Pressable onPress={() => setSearchText('')} hitSlop={8}>
            <FontAwesome name="times-circle" size={18} color={mutedColor} />
          </Pressable>
        )}
      </View>

      {/* Add product button */}
      <Pressable
        onPress={() => setAddModalVisible(true)}
        style={[styles.addButton, { backgroundColor: colors.tint }]}
      >
        <FontAwesome name="plus" size={18} color="#fff" />
        <Text style={styles.addButtonText}>Add Product</Text>
      </Pressable>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: mutedColor }]}>Loading products...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome name="archive" size={48} color={mutedColor} />
          <Text style={[styles.emptyTitle, { color: textColor }]}>No products yet</Text>
          <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
            Add your first product to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProductItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
        />
      )}

      {/* Product detail modal */}
      <Modal
        visible={!!selectedProduct}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedProduct(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedProduct(null)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalContentInner}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]} numberOfLines={1}>
                {selectedProduct?.name}
              </Text>
              <Pressable onPress={() => setSelectedProduct(null)} hitSlop={12}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            {selectedProduct && (
              <>
                <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
                  {selectedProduct.imageUrl && (
                    <Image
                      source={{ uri: resolveImageUrl(selectedProduct.imageUrl) }}
                      style={styles.detailImage}
                      contentFit="cover"
                    />
                  )}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Name</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>{selectedProduct.name}</Text>
                  </View>
                  {selectedProduct.sku && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: mutedColor }]}>SKU</Text>
                      <Text style={[styles.detailValue, { color: textColor }]}>{selectedProduct.sku}</Text>
                    </View>
                  )}
                  {selectedProduct.barcode && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: mutedColor }]}>Barcode</Text>
                      <Text style={[styles.detailValue, { color: textColor }]}>
                        {selectedProduct.barcode}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Selling Price</Text>
                    <Text style={[styles.detailValue, { color: colors.tint, fontSize: 18, fontWeight: '700' }]}>
                      {formatCurrency(selectedProduct.sellingPrice)}
                    </Text>
                  </View>
                  {selectedProduct.costPrice && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: mutedColor }]}>Cost Price</Text>
                      <Text style={[styles.detailValue, { color: textColor }]}>
                        {formatCurrency(selectedProduct.costPrice)}
                      </Text>
                    </View>
                  )}
                  {(selectedProduct.trackStock === false || selectedProduct.quantityOnHand !== undefined) && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: mutedColor }]}>Stock</Text>
                      <Text
                        style={[
                          styles.detailValue,
                          selectedProduct.trackStock === false
                            ? { color: mutedColor, fontWeight: '500' }
                            : {
                                color:
                                  selectedProduct.quantityOnHand === 0
                                    ? '#ef4444'
                                    : selectedProduct.quantityOnHand! < 10
                                    ? '#f59e0b'
                                    : '#10b981',
                                fontWeight: '600',
                              },
                        ]}
                      >
                        {selectedProduct.trackStock === false
                          ? 'Made to order'
                          : `${selectedProduct.quantityOnHand} units`}
                      </Text>
                    </View>
                  )}
                  {selectedProduct.category && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: mutedColor }]}>Category</Text>
                      <Text style={[styles.detailValue, { color: textColor }]}>
                        {selectedProduct.category.name}
                      </Text>
                    </View>
                  )}
                </ScrollView>
                {/* Action buttons footer */}
                <View style={[styles.modalFooter, { borderTopColor: borderColor }]}>
                  <Pressable
                    onPress={() => handleEditProduct(selectedProduct)}
                    style={[styles.actionButton, { borderColor }]}
                  >
                    <FontAwesome name="edit" size={18} color={colors.tint} />
                    <Text style={[styles.actionButtonText, { color: colors.tint }]}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleAddToCart(selectedProduct)}
                    style={[styles.actionButton, { backgroundColor: colors.tint }]}
                  >
                    <FontAwesome name="shopping-cart" size={18} color="#fff" />
                    <Text style={styles.actionButtonTextPrimary}>Add to Cart</Text>
                  </Pressable>
                </View>
              </>
            )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add product modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAddModalVisible(false)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Add Product</Text>
              <Pressable onPress={() => setAddModalVisible(false)} hitSlop={12}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Product Name *</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="Product name"
                  placeholderTextColor={mutedColor}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>SKU</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="SKU (optional)"
                  placeholderTextColor={mutedColor}
                  value={formData.sku}
                  onChangeText={(text) => setFormData({ ...formData, sku: text })}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Barcode</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="Barcode (optional)"
                  placeholderTextColor={mutedColor}
                  value={formData.barcode}
                  onChangeText={(text) => setFormData({ ...formData, barcode: text })}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Selling Price *</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="0.00"
                  placeholderTextColor={mutedColor}
                  value={formData.sellingPrice}
                  onChangeText={(text) => setFormData({ ...formData, sellingPrice: text })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Cost Price</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="0.00"
                  placeholderTextColor={mutedColor}
                  value={formData.costPrice}
                  onChangeText={(text) => setFormData({ ...formData, costPrice: text })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Initial Stock</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="0"
                  placeholderTextColor={mutedColor}
                  value={formData.quantityOnHand}
                  onChangeText={(text) => setFormData({ ...formData, quantityOnHand: text })}
                  keyboardType="number-pad"
                />
              </View>
              <Pressable
                onPress={handleCreateProduct}
                disabled={createProductMutation.isPending}
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.tint },
                  createProductMutation.isPending && styles.submitButtonDisabled,
                ]}
              >
                {createProductMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Product</Text>
                )}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit product modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setEditModalVisible(false);
          setEditingProduct(null);
        }}
      >
        <Pressable style={styles.modalOverlay} onPress={() => {
          setEditModalVisible(false);
          setEditingProduct(null);
        }}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalContentInner}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: textColor }]}>Edit Product</Text>
                <Pressable onPress={() => {
                  setEditModalVisible(false);
                  setEditingProduct(null);
                }} hitSlop={12}>
                  <FontAwesome name="times" size={22} color={mutedColor} />
                </Pressable>
              </View>
              <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textColor }]}>Product Name *</Text>
                  <TextInput
                    style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                    placeholder="Product name"
                    placeholderTextColor={mutedColor}
                    value={editFormData.name}
                    onChangeText={(text) => setEditFormData({ ...editFormData, name: text })}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textColor }]}>SKU</Text>
                  <TextInput
                    style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                    placeholder="SKU (optional)"
                    placeholderTextColor={mutedColor}
                    value={editFormData.sku}
                    onChangeText={(text) => setEditFormData({ ...editFormData, sku: text })}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textColor }]}>Barcode</Text>
                  <TextInput
                    style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                    placeholder="Barcode (optional)"
                    placeholderTextColor={mutedColor}
                    value={editFormData.barcode}
                    onChangeText={(text) => setEditFormData({ ...editFormData, barcode: text })}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textColor }]}>Selling Price *</Text>
                  <TextInput
                    style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                    placeholder="0.00"
                    placeholderTextColor={mutedColor}
                    value={editFormData.sellingPrice}
                    onChangeText={(text) => setEditFormData({ ...editFormData, sellingPrice: text })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textColor }]}>Cost Price</Text>
                  <TextInput
                    style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                    placeholder="0.00"
                    placeholderTextColor={mutedColor}
                    value={editFormData.costPrice}
                    onChangeText={(text) => setEditFormData({ ...editFormData, costPrice: text })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textColor }]}>Stock Quantity</Text>
                  <TextInput
                    style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                    placeholder="0"
                    placeholderTextColor={mutedColor}
                    value={editFormData.quantityOnHand}
                    onChangeText={(text) => setEditFormData({ ...editFormData, quantityOnHand: text })}
                    keyboardType="number-pad"
                  />
                </View>
              </ScrollView>
              {/* Action buttons footer */}
              <View style={[styles.modalFooter, { borderTopColor: borderColor }]}>
                <Pressable
                  onPress={handleDeleteProduct}
                  disabled={deleteProductMutation.isPending}
                  style={[
                    styles.actionButton,
                    { borderColor: '#ef4444' },
                    deleteProductMutation.isPending && styles.submitButtonDisabled,
                  ]}
                >
                  {deleteProductMutation.isPending ? (
                    <ActivityIndicator color="#ef4444" />
                  ) : (
                    <>
                      <FontAwesome name="trash" size={18} color="#ef4444" />
                      <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Delete</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleUpdateProduct}
                  disabled={updateProductMutation.isPending}
                  style={[
                    styles.actionButton,
                    { backgroundColor: colors.tint },
                    updateProductMutation.isPending && styles.submitButtonDisabled,
                  ]}
                >
                  {updateProductMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <FontAwesome name="save" size={18} color="#fff" />
                      <Text style={styles.actionButtonTextPrimary}>Save Changes</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  row: { justifyContent: 'space-between', marginBottom: 12 },
  productCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: '#f3f4f6',
    minHeight: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f3f4f6',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    minHeight: 120,
  },
  cardContent: {
    padding: 12,
  },
  cardProductName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  cardSku: { fontSize: 11, marginBottom: 4 },
  cardPrice: { fontSize: 15, fontWeight: '700' },
  stockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stockBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    width: '100%',
  },
  modalContentInner: {
    flex: 1,
    flexDirection: 'column',
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
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 20 },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  detailImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 20 },
  detailRow: { marginBottom: 16 },
  detailLabel: { fontSize: 12, marginBottom: 4 },
  detailValue: { fontSize: 16, fontWeight: '500' },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  submitButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  submitButtonDisabled: { opacity: 0.6 },
});
