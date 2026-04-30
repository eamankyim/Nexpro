import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { materialsService } from '@/services/materialsService';
import { useAuth } from '@/context/AuthContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { CURRENCY, resolveBusinessType } from '@/constants';

function formatCurrency(value: number | string | null | undefined): string {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value ?? 0)) || 0;
  return `${CURRENCY.SYMBOL} ${numValue.toFixed(CURRENCY.DECIMAL_PLACES)}`;
}

function getStockStatus(quantity: number, reorderLevel: number): { color: string; label: string } {
  if (quantity <= 0) return { color: '#ef4444', label: 'Out of stock' };
  if (quantity <= reorderLevel) return { color: '#f59e0b', label: 'Low stock' };
  return { color: '#10b981', label: 'In stock' };
}

type MaterialItem = {
  id: string;
  name: string;
  sku?: string;
  quantityOnHand: number;
  reorderLevel?: number;
  unitCost?: number;
  unit?: string;
  category?: { id: string; name: string };
  isActive?: boolean;
};

export default function MaterialsScreen() {
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const queryClient = useQueryClient();
  const { activeTenant, activeTenantId, hasFeature } = useAuth();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<MaterialItem | null>(null);
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [restockData, setRestockData] = useState({ quantity: '', unitCost: '', reference: '' });

  const resolvedType = resolveBusinessType(activeTenant?.businessType);
  const isShop = resolvedType === 'shop';
  const isPharmacy = resolvedType === 'pharmacy';

  const { data: response, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['materials', 'items', activeTenantId, statusFilter],
    queryFn: () => {
      const params: { page?: number; limit?: number; status?: string; lowStock?: boolean; outOfStock?: boolean } = {
        page: 1,
        limit: 20,
      };
      if (statusFilter === 'low') params.lowStock = true;
      if (statusFilter === 'out') params.outOfStock = true;
      return materialsService.getItems(params);
    },
    enabled: !!activeTenantId && hasFeature('materials'),
    staleTime: 3 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  const restockMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { quantity: number; unitCost?: number; reference?: string } }) =>
      materialsService.restock(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setRestockModalVisible(false);
      setRestockData({ quantity: '', unitCost: '', reference: '' });
      Alert.alert('Success', 'Materials restocked successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to restock materials');
    },
  });

  const items = (response?.data || []) as MaterialItem[];
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const handleItemPress = useCallback((item: MaterialItem) => {
    setSelectedItem(item);
  }, []);

  const handleRestock = useCallback((item: MaterialItem) => {
    setSelectedItem(item);
    setRestockData({
      quantity: '',
      unitCost: item.unitCost?.toString() || '',
      reference: '',
    });
    setRestockModalVisible(true);
  }, []);

  const handleRestockSubmit = useCallback(() => {
    if (!selectedItem) return;
    if (!restockData.quantity || parseFloat(restockData.quantity) <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    restockMutation.mutate({
      id: selectedItem.id,
      data: {
        quantity: parseFloat(restockData.quantity),
        unitCost: restockData.unitCost ? parseFloat(restockData.unitCost) : undefined,
        reference: restockData.reference.trim() || undefined,
      },
    });
  }, [selectedItem, restockData, restockMutation]);

  if (!hasFeature('materials')) {
    return <FeatureAccessDenied message="Materials are not enabled for this workspace." />;
  }

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';
  const inputBg = resolvedTheme === 'dark' ? '#18181b' : '#f9fafb';

  if (!isShop && !isPharmacy) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.emptyTitle, { color: textColor }]}>Materials</Text>
        <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
          Materials are available for shop and pharmacy businesses.
        </Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: MaterialItem }) => {
    const stockStatus = getStockStatus(item.quantityOnHand, item.reorderLevel || 0);

    return (
      <Pressable
        onPress={() => handleItemPress(item)}
        style={({ pressed }) => [
          styles.itemCard,
          { backgroundColor: cardBg, borderColor },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.sku && (
              <Text style={[styles.itemSku, { color: mutedColor }]}>SKU: {item.sku}</Text>
            )}
            <View style={styles.itemMeta}>
              <View style={[styles.stockBadge, { backgroundColor: stockStatus.color + '20' }]}>
                <Text style={[styles.stockText, { color: stockStatus.color }]}>
                  {stockStatus.label} ({item.quantityOnHand} {item.unit || 'units'})
                </Text>
              </View>
              {item.unitCost && (
                <Text style={[styles.itemCost, { color: mutedColor }]}>
                  Cost: {formatCurrency(item.unitCost)}
                </Text>
              )}
            </View>
          </View>
          <Pressable
            onPress={() => handleRestock(item)}
            style={[styles.restockButton, { backgroundColor: colors.tint }]}
          >
            <FontAwesome name="plus" size={14} color="#fff" />
            <Text style={styles.restockButtonText}>Restock</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Status filter */}
      <View style={styles.filterRow}>
        {['all', 'low', 'out'].map((s) => (
          <Pressable
            key={s}
            onPress={() => setStatusFilter(s)}
            style={[
              styles.filterBtn,
              { borderColor },
              statusFilter === s && { backgroundColor: colors.tint, borderColor: colors.tint },
            ]}
          >
            <Text style={[styles.filterText, { color: statusFilter === s ? '#fff' : textColor }]}>
              {s === 'out' ? 'Out of Stock' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: mutedColor }]}>Loading materials...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="archive" size={48} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No materials items</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                Add items to track your materials
              </Text>
            </View>
          }
        />
      )}

      {/* Item detail modal */}
      <Modal
        visible={!!selectedItem && !restockModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedItem(null)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]} numberOfLines={1}>
                {selectedItem?.name}
              </Text>
              <Pressable onPress={() => setSelectedItem(null)} hitSlop={12}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            {selectedItem && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Name</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>{selectedItem.name}</Text>
                </View>
                {selectedItem.sku && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>SKU</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>{selectedItem.sku}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Stock</Text>
                  <View
                    style={[
                      styles.stockBadge,
                      {
                        backgroundColor:
                          getStockStatus(selectedItem.quantityOnHand, selectedItem.reorderLevel || 0).color +
                          '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stockText,
                        {
                          color: getStockStatus(
                            selectedItem.quantityOnHand,
                            selectedItem.reorderLevel || 0
                          ).color,
                        },
                      ]}
                    >
                      {selectedItem.quantityOnHand} {selectedItem.unit || 'units'}
                    </Text>
                  </View>
                </View>
                {selectedItem.reorderLevel !== undefined && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Reorder Level</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {selectedItem.reorderLevel} {selectedItem.unit || 'units'}
                    </Text>
                  </View>
                )}
                {selectedItem.unitCost && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Unit Cost</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {formatCurrency(selectedItem.unitCost)}
                    </Text>
                  </View>
                )}
                {selectedItem.category && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Category</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {selectedItem.category.name}
                    </Text>
                  </View>
                )}
                <Pressable
                  onPress={() => handleRestock(selectedItem)}
                  style={[styles.actionButton, { backgroundColor: colors.tint }]}
                >
                  <FontAwesome name="plus" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Restock</Text>
                </Pressable>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Restock modal */}
      <Modal
        visible={restockModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRestockModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRestockModalVisible(false)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Restock Item</Text>
              <Pressable onPress={() => setRestockModalVisible(false)} hitSlop={12}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedItem && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Item</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>{selectedItem.name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Current Stock</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {selectedItem.quantityOnHand} {selectedItem.unit || 'units'}
                    </Text>
                  </View>
                </>
              )}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Quantity to Add *</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="0"
                  placeholderTextColor={mutedColor}
                  value={restockData.quantity}
                  onChangeText={(text) => setRestockData({ ...restockData, quantity: text })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Unit Cost</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="0.00"
                  placeholderTextColor={mutedColor}
                  value={restockData.unitCost}
                  onChangeText={(text) => setRestockData({ ...restockData, unitCost: text })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Reference</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="Invoice number, PO, etc."
                  placeholderTextColor={mutedColor}
                  value={restockData.reference}
                  onChangeText={(text) => setRestockData({ ...restockData, reference: text })}
                />
              </View>
              <Pressable
                onPress={handleRestockSubmit}
                disabled={restockMutation.isPending}
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.tint },
                  restockMutation.isPending && styles.submitButtonDisabled,
                ]}
              >
                {restockMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Restock</Text>
                )}
              </Pressable>
            </ScrollView>
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
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  filterText: { fontSize: 14, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  itemCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemInfo: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  itemSku: { fontSize: 12, marginBottom: 8 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stockText: { fontSize: 12, fontWeight: '600' },
  itemCost: { fontSize: 12 },
  restockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  restockButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
  detailRow: { marginBottom: 16 },
  detailLabel: { fontSize: 12, marginBottom: 4 },
  detailValue: { fontSize: 16, fontWeight: '500' },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
