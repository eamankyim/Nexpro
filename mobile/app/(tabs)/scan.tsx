import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  FlatList,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { productService } from '@/services/productService';
import { jobService } from '@/services/jobService';
import { customerService } from '@/services/customerService';
import { STUDIO_TYPES, CURRENCY } from '@/constants';
import Colors from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { parseProductQRPayload, isProductQRCode } from '@/utils/productQR';
import { useDebounce } from '@/hooks/useDebounce';
import { resolveImageUrl } from '@/utils/fileUtils';
import { Image } from 'expo-image';

export default function ScanScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeTenant, activeTenantId, hasFeature } = useAuth();
  const { getItemCount, addItem } = useCart();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const cartItemCount = getItemCount();

  const businessType = activeTenant?.businessType ?? 'printing_press';
  const isStudio = STUDIO_TYPES.includes(businessType);
  const productQueriesEnabled =
    !!activeTenantId && !isStudio && hasFeature('products');
  const studioCustomerQueryEnabled =
    !!activeTenantId && isStudio && hasFeature('crm');

  const [searchQuery, setSearchQuery] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<any>(null);
  const [jobForm, setJobForm] = useState({
    customerId: '',
    title: '',
    description: '',
    dueDate: '',
  });

  // Debounce search query for unified search (name or barcode)
  const debouncedSearch = useDebounce(searchQuery, 500);

  // Check if search query looks like a barcode (numeric or alphanumeric, typically longer)
  const isLikelyBarcode = /^[A-Z0-9]{6,}$/i.test(debouncedSearch.trim());

  // Fetch default product list (most frequent/popular products) when no search
  const { data: defaultProductsResponse, isLoading: loadingDefaultProducts } = useQuery({
    queryKey: ['products', 'default', activeTenantId],
    queryFn: () =>
      productService.getProducts({
        limit: 30,
        isActive: true,
      }),
    enabled: productQueriesEnabled && !debouncedSearch && !scannedProduct,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  const { data: productsResponse, isLoading: loadingProducts } = useQuery({
    queryKey: ['products', 'search', activeTenantId, debouncedSearch],
    queryFn: () =>
      productService.getProducts({
        search: debouncedSearch || undefined,
        limit: 20,
        isActive: true,
      }),
    enabled:
      productQueriesEnabled &&
      !!debouncedSearch &&
      debouncedSearch.length >= 2 &&
      !scannedProduct,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  const { data: barcodeResponse, isLoading: loadingBarcode, isError: barcodeError } = useQuery({
    queryKey: ['product', 'barcode', activeTenantId, debouncedSearch],
    queryFn: () => productService.getProductByBarcode(debouncedSearch),
    enabled:
      !!activeTenantId &&
      !!debouncedSearch &&
      debouncedSearch.length >= 2 &&
      !isStudio &&
      !scannedProduct &&
      isLikelyBarcode,
    staleTime: 0,
    retry: false,
  });

  const { data: customersResponse } = useQuery({
    queryKey: ['customers', 'list', activeTenantId],
    queryFn: () => customerService.getCustomers({ limit: 50 }),
    enabled: studioCustomerQueryEnabled,
    // Customer list for dropdowns can be stale for 5 minutes
    staleTime: 5 * 60 * 1000,
    // Keep in cache for 2 hours
    gcTime: 2 * 60 * 60 * 1000,
  });

  const createJobMutation = useMutation({
    mutationFn: (d: {
      customerId: string;
      title: string;
      description?: string;
      dueDate?: string;
      status?: string;
      priority?: string;
    }) => jobService.createJob(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setJobForm({ customerId: '', title: '', description: '', dueDate: '' });
      Alert.alert('Success', 'Job created successfully');
    },
    onError: (err: Error) => {
      Alert.alert('Error', err?.message ?? 'Failed to create job');
    },
  });


  const handleScan = useCallback((scannedData: string) => {
    // Check if scanned data is a product QR code (JSON) or a regular barcode
    if (isProductQRCode(scannedData)) {
      const result = parseProductQRPayload(scannedData);
      if (result.success && result.data) {
        // Use product data directly from QR code
        setScannedProduct(result.data);
        // Set search query to barcode if available, otherwise clear
        setSearchQuery(result.data.barcode || '');
      } else {
        // Fallback to barcode search if parsing fails
        setSearchQuery(scannedData);
        setScannedProduct(null);
      }
    } else {
      // Regular barcode - set in unified search
      setSearchQuery(scannedData);
      setScannedProduct(null);
    }
  }, []);

  const handleCreateJob = useCallback(() => {
    if (!jobForm.customerId) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }
    if (!jobForm.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    createJobMutation.mutate({
      customerId: jobForm.customerId,
      title: jobForm.title.trim(),
      description: jobForm.description.trim() || undefined,
      dueDate: jobForm.dueDate || undefined,
      status: 'new',
      priority: 'medium',
    });
  }, [jobForm, createJobMutation]);

  const handleProductSelect = useCallback(
    (selectedProduct: any) => {
      addItem({
        id: selectedProduct.id,
        name: selectedProduct.name,
        sellingPrice: selectedProduct.sellingPrice,
        price: selectedProduct.price,
        costPrice: selectedProduct.costPrice,
        imageUrl: selectedProduct.imageUrl,
        sku: selectedProduct.sku,
        barcode: selectedProduct.barcode,
      });
      setSearchQuery('');
      setScannedProduct(null);
    },
    [addItem]
  );

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const inputBg = resolvedTheme === 'dark' ? '#27272a' : '#f3f4f6';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  // Match web app pattern: response?.data || []
  const customers = (customersResponse?.data || []) as Array<{ id: string; name: string }>;
  
  // Default products (when no search) - sorted by stock quantity (most stock = likely most popular)
  const defaultProducts = useMemo(() => {
    const products = (defaultProductsResponse?.data || []) as Array<{
      id: string;
      name: string;
      sellingPrice?: number;
      costPrice?: number;
      price?: number;
      barcode?: string;
      sku?: string;
      quantityOnHand?: number;
      trackStock?: boolean;
      imageUrl?: string;
    }>;
    // Sort by stock quantity (descending), then by name (ascending). Made-to-order (trackStock false) treated as high stock.
    return [...products].sort((a, b) => {
      const stockA = a.trackStock === false ? Infinity : (a.quantityOnHand ?? 0);
      const stockB = b.trackStock === false ? Infinity : (b.quantityOnHand ?? 0);
      if (stockB !== stockA) {
        return stockB - stockA; // Higher stock first
      }
      return (a.name || '').localeCompare(b.name || ''); // Alphabetical if same stock
    });
  }, [defaultProductsResponse]);

  // Products from search
  const products = (productsResponse?.data || []) as Array<{
    id: string;
    name: string;
    sellingPrice?: number;
    costPrice?: number;
    price?: number;
    barcode?: string;
    sku?: string;
    quantityOnHand?: number;
    trackStock?: boolean;
    imageUrl?: string;
  }>;
  
  // Single product from barcode search
  const barcodeProduct = barcodeResponse?.data?.data || barcodeResponse?.data || barcodeResponse;
  const foundBarcodeProduct =
    !barcodeError && barcodeProduct && typeof barcodeProduct === 'object' && !Array.isArray(barcodeProduct);
  
  // Determine which products to show
  const productsToShow = debouncedSearch ? products : defaultProducts;
  const isLoadingProductsList = debouncedSearch ? loadingProducts : loadingDefaultProducts;

  if (isStudio && !hasFeature('jobAutomation')) {
    return (
      <FeatureAccessDenied message="Jobs are not enabled for this workspace." />
    );
  }

  if (!isStudio && !hasFeature('products')) {
    return (
      <FeatureAccessDenied message="Products are not enabled for this workspace." />
    );
  }

  if (isStudio) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: textColor }]}>New job</Text>
        <Text style={[styles.subtitle, { color: mutedColor }]}>Create a new job or quote</Text>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.label, { color: mutedColor }]}>Customer *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.customerScroll}>
            {customers.map((c: { id: string; name: string }) => (
              <Pressable
                key={c.id}
                onPress={() => setJobForm((p) => ({ ...p, customerId: c.id }))}
                style={[
                  styles.customerChip,
                  { borderColor },
                  jobForm.customerId === c.id && { backgroundColor: colors.tint, borderColor: colors.tint },
                ]}
              >
                <Text
                  style={[
                    styles.customerChipText,
                    { color: jobForm.customerId === c.id ? '#fff' : textColor },
                  ]}
                  numberOfLines={1}
                >
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {customers.length === 0 && (
            <Text style={[styles.hint, { color: mutedColor }]}>Add customers first in the Customers tab</Text>
          )}

          <Text style={[styles.label, { color: mutedColor }]}>Title *</Text>
          <TextInput
            style={[styles.input, { color: textColor, borderColor }]}
            placeholder="Job title"
            placeholderTextColor={mutedColor}
            value={jobForm.title}
            onChangeText={(t) => setJobForm((p) => ({ ...p, title: t }))}
          />
          <Text style={[styles.label, { color: mutedColor }]}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea, { color: textColor, borderColor }]}
            placeholder="Notes or description"
            placeholderTextColor={mutedColor}
            value={jobForm.description}
            onChangeText={(t) => setJobForm((p) => ({ ...p, description: t }))}
            multiline
          />
          <Text style={[styles.label, { color: mutedColor }]}>Due date</Text>
          <TextInput
            style={[styles.input, { color: textColor, borderColor }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={mutedColor}
            value={jobForm.dueDate}
            onChangeText={(t) => setJobForm((p) => ({ ...p, dueDate: t }))}
          />
          <Pressable
            onPress={handleCreateJob}
            disabled={createJobMutation.isPending}
            style={[styles.primaryBtn, { backgroundColor: colors.tint }]}
          >
            {createJobMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Create job</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      {/* Cart FAB */}
      {cartItemCount > 0 && (
        <Pressable
          onPress={() => router.push('/(tabs)/cart')}
          style={[styles.cartFAB, { backgroundColor: colors.tint }]}
        >
          <FontAwesome name="shopping-cart" size={20} color="#fff" />
          {cartItemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartItemCount > 99 ? '99+' : cartItemCount}</Text>
            </View>
          )}
        </Pressable>
      )}

      <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: textColor }]}>Add products</Text>
        <Text style={[styles.subtitle, { color: mutedColor }]}>
          Search by name, scan barcode, or browse products
        </Text>

        {/* Unified Search Bar */}
        <View style={[styles.searchCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={[styles.searchRow, { backgroundColor: inputBg }]}>
            <FontAwesome name="search" size={18} color={mutedColor} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search by name or barcode..."
              placeholderTextColor={mutedColor}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setScannedProduct(null);
              }}
              onSubmitEditing={() => {
                // Search is handled automatically via debounced query
              }}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  setSearchQuery('');
                  setScannedProduct(null);
                }}
                style={styles.clearBtn}
              >
                <FontAwesome name="times" size={16} color={mutedColor} />
              </Pressable>
            )}
            <Pressable
              onPress={() => setScannerVisible(true)}
              style={[styles.scanBtn, { backgroundColor: colors.tint }]}
            >
              <FontAwesome name="camera" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Loading state */}
        {(isLoadingProductsList || loadingBarcode) && (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.tint} />
            <Text style={[styles.loadingText, { color: mutedColor }]}>
              {debouncedSearch ? 'Searching products...' : 'Loading products...'}
            </Text>
          </View>
        )}

        {/* Show barcode product first if found (exact match) */}
        {!loadingBarcode && foundBarcodeProduct && (
          <View style={styles.productResult}>
            {(barcodeProduct as { imageUrl?: string }).imageUrl && (
              <Image
                source={{ uri: resolveImageUrl((barcodeProduct as { imageUrl?: string }).imageUrl) }}
                style={styles.productResultImage}
                contentFit="cover"
                transition={200}
              />
            )}
            <Text style={[styles.productName, { color: textColor }]}>
              {(barcodeProduct as { name?: string }).name ?? 'Product'}
            </Text>
            <Text style={[styles.productPrice, { color: colors.tint }]}>
              {CURRENCY.SYMBOL}{' '}
              {Number(
                (barcodeProduct as { sellingPrice?: number; price?: number }).sellingPrice ??
                  (barcodeProduct as { price?: number }).price ??
                  0
              ).toFixed(CURRENCY.DECIMAL_PLACES)}
            </Text>
            {(barcodeProduct as { barcode?: string }).barcode && (
              <Text style={[styles.productBarcode, { color: mutedColor }]}>
                Barcode: {(barcodeProduct as { barcode?: string }).barcode}
              </Text>
            )}
            <Pressable
              style={[styles.addBtn, { backgroundColor: colors.tint }]}
              onPress={() => handleProductSelect(barcodeProduct)}
            >
              <Text style={styles.addBtnText}>Add to cart</Text>
            </Pressable>
          </View>
        )}

        {/* Product list - default list or search results */}
        {!isLoadingProductsList &&
          !foundBarcodeProduct &&
          !scannedProduct &&
          productsToShow.length > 0 && (
            <View style={styles.productListContainer}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                {debouncedSearch
                  ? `Found ${productsToShow.length} product${productsToShow.length !== 1 ? 's' : ''}`
                  : 'Frequently used products'}
              </Text>
              <FlatList
                data={productsToShow}
                numColumns={2}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                columnWrapperStyle={styles.productRow}
                renderItem={({ item: p }) => (
                  <Pressable
                    onPress={() => handleProductSelect(p)}
                    style={[styles.productCard, { backgroundColor: cardBg, borderColor }]}
                  >
                    {/* Product Image */}
                    <View style={styles.productImageContainer}>
                      {p.imageUrl ? (
                        <Image
                          source={{ uri: resolveImageUrl(p.imageUrl) }}
                          style={styles.productImage}
                          contentFit="cover"
                          transition={200}
                          placeholder={require('@/assets/images/icon.png')}
                        />
                      ) : (
                        <View style={[styles.productImagePlaceholder, { backgroundColor: inputBg }]}>
                          <FontAwesome name="archive" size={20} color={mutedColor} />
                        </View>
                      )}
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={[styles.productName, { color: textColor }]} numberOfLines={2}>
                        {p.name}
                      </Text>
                      <Text style={[styles.productPrice, { color: colors.tint }]}>
                        {CURRENCY.SYMBOL}{' '}
                        {Number(p.sellingPrice ?? p.price ?? p.costPrice ?? 0).toFixed(CURRENCY.DECIMAL_PLACES)}
                      </Text>
                      {p.trackStock === false ? (
                        <Text style={[styles.productStock, { color: mutedColor }]}>
                          Made to order
                        </Text>
                      ) : p.quantityOnHand !== undefined && (
                        <Text style={[styles.productStock, { color: mutedColor }]}>
                          Stock: {p.quantityOnHand}
                        </Text>
                      )}
                    </View>
                    {/* Add to cart button */}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleProductSelect(p);
                      }}
                      style={[styles.addToCartBtn, { backgroundColor: colors.tint }]}
                    >
                      <FontAwesome name="plus" size={16} color="#fff" />
                    </Pressable>
                  </Pressable>
                )}
              />
            </View>
          )}

        {/* No products found (only show when searching) */}
        {!isLoadingProductsList &&
          !loadingBarcode &&
          debouncedSearch &&
          productsToShow.length === 0 &&
          !scannedProduct &&
          !foundBarcodeProduct && (
            <View style={styles.emptyState}>
              <FontAwesome name="search" size={48} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No products found</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                Try a different search term or scan a barcode
              </Text>
            </View>
          )}

        {/* Empty state when no products at all */}
        {!isLoadingProductsList &&
          !loadingBarcode &&
          !debouncedSearch &&
          productsToShow.length === 0 &&
          !scannedProduct &&
          !foundBarcodeProduct && (
            <View style={styles.emptyState}>
              <FontAwesome name="archive" size={48} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No products available</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                Add products to get started, or search for products
              </Text>
            </View>
          )}

        {/* Show scanned product from QR code */}
        {!loadingProducts && !loadingBarcode && scannedProduct && (
          <View style={styles.productResult}>
            {scannedProduct.imageUrl && (
              <Image
                source={{ uri: resolveImageUrl(scannedProduct.imageUrl) }}
                style={styles.productResultImage}
                contentFit="cover"
                transition={200}
              />
            )}
            <Text style={[styles.productName, { color: textColor }]}>
              {scannedProduct.name ?? 'Product'}
            </Text>
            <Text style={[styles.productPrice, { color: colors.tint }]}>
              {CURRENCY.SYMBOL}{' '}
              {Number(scannedProduct.sellingPrice ?? scannedProduct.costPrice ?? 0).toFixed(
                CURRENCY.DECIMAL_PLACES
              )}
            </Text>
            {scannedProduct.barcode && (
              <Text style={[styles.productBarcode, { color: mutedColor }]}>
                Barcode: {scannedProduct.barcode}
              </Text>
            )}
            <Pressable
              style={[styles.addBtn, { backgroundColor: colors.tint }]}
              onPress={() => handleProductSelect(scannedProduct)}
            >
              <Text style={styles.addBtnText}>Add to cart</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, marginBottom: 20 },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  customerScroll: { marginBottom: 8, maxHeight: 44 },
  customerChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  customerChipText: { fontSize: 14, fontWeight: '500' },
  hint: { fontSize: 13, marginTop: 4 },
  primaryBtn: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  clearBtn: { padding: 6, marginRight: 2 },
  scanBtn: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 4,
  },
  loading: { padding: 24, alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  productListContainer: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  productRow: {
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  productCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 0, // Important for flex items to shrink properly
    maxWidth: '48%', // Ensure two items fit per row
    position: 'relative', // For absolute positioned button
  },
  productImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    marginBottom: 8,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: { alignItems: 'flex-start' },
  productName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  productSku: { fontSize: 11, marginTop: 2 },
  productBarcode: { fontSize: 11, marginTop: 2 },
  productPrice: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  productStock: { fontSize: 11, marginTop: 2 },
  addToCartBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  productResult: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  productResultImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
  },
  addBtn: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 48, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cartFAB: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
