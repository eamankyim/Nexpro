import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { AppIcon } from '@/components/AppIcon';
import { FormSheetModal } from '@/components/FormSheetModal';
import { FORM_LABELS } from '@/constants/formLabels';
import { ListEmptyState, EmptyStateActionButton, ListActionButton } from '@/components/ListEmptyState';
import { SEARCH_PLACEHOLDERS } from '@/constants/searchPlaceholders';
import { useSmartSearch } from '@/context/SmartSearchContext';
import { useRegisterPageSearch } from '@/hooks/useRegisterPageSearch';
import { useDebounce } from '@/hooks/useDebounce';
import { flatListStyleForEmpty, showListFilters } from '@/utils/listEmptyLayout';
import { materialsService } from '@/services/materialsService';
import { useAuth } from '@/context/AuthContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { getApiErrorMessage, parseApiListResponse } from '@/utils/parseApiListResponse';
import { FilterChipRow } from '@/components/FilterChip';
import { ListLoadingState, ListErrorState } from '@/components/ListScreenStates';
import { refreshAfterMaterialChange, QUERY_STALE } from '@/utils/queryInvalidation';
import { CURRENCY, resolveBusinessType } from '@/constants';
import { formatCurrency } from '@/utils/formatCurrency';

const MATERIAL_UNITS = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'unit', label: 'Unit' },
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'L', label: 'L' },
  { value: 'mL', label: 'mL' },
  { value: 'bag', label: 'Bag' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
  { value: 'carton', label: 'Carton' },
] as const;

type MaterialCategory = { id: string; name: string };

const INITIAL_FORM = {
  name: '',
  sku: '',
  unit: 'pcs',
  quantityOnHand: '0',
  reorderLevel: '0',
  unitCost: '',
  categoryId: '',
};

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
  const router = useRouter();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor, inputBg } = useScreenColors();
  const queryClient = useQueryClient();
  const { activeTenant, activeTenantId, hasFeature } = useAuth();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

  const { searchValue } = useSmartSearch();
  useRegisterPageSearch({ scope: 'materials', placeholder: SEARCH_PLACEHOLDERS.MATERIALS });
  const debouncedSearch = useDebounce(searchValue, 400);

  const resolvedType = resolveBusinessType(activeTenant?.businessType);
  const isShop = resolvedType === 'shop';
  const isPharmacy = resolvedType === 'pharmacy';
  const isStudio = resolvedType === 'studio';

  const { data: categoriesResponse } = useQuery({
    queryKey: ['materials', 'categories', activeTenantId],
    queryFn: () => materialsService.getCategories(),
    enabled: !!activeTenantId && hasFeature('materials'),
    staleTime: QUERY_STALE.SLOW,
  });

  const categories = useMemo(
    () => parseApiListResponse<MaterialCategory>(categoriesResponse),
    [categoriesResponse]
  );

  const { data: response, isLoading, refetch, isRefetching, error, isError } = useQuery({
    queryKey: ['materials', 'items', activeTenantId, statusFilter, debouncedSearch],
    queryFn: () => {
      const params: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        lowStock?: boolean;
        outOfStock?: boolean;
      } = {
        page: 1,
        limit: 20,
        search: debouncedSearch || undefined,
      };
      if (statusFilter === 'low') params.lowStock = true;
      if (statusFilter === 'out') params.outOfStock = true;
      return materialsService.getItems(params);
    },
    enabled: !!activeTenantId && hasFeature('materials'),
    staleTime: QUERY_STALE.LIST,
    gcTime: 2 * 60 * 60 * 1000,
  });

  useEffect(() => {
    if (addModalVisible && !formData.categoryId && categories.length > 0) {
      setFormData((prev) => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [addModalVisible, categories, formData.categoryId]);

  const createMutation = useMutation({
    mutationFn: () =>
      materialsService.createItem({
        name: formData.name.trim(),
        sku: formData.sku.trim() || undefined,
        unit: formData.unit,
        quantityOnHand: parseFloat(formData.quantityOnHand) || 0,
        reorderLevel: parseFloat(formData.reorderLevel) || 0,
        unitCost: formData.unitCost ? parseFloat(formData.unitCost) : undefined,
        categoryId: formData.categoryId || undefined,
        isActive: true,
      }),
    onSuccess: async () => {
      await refreshAfterMaterialChange(queryClient);
      setAddModalVisible(false);
      setFormData(INITIAL_FORM);
      Alert.alert('Success', 'Material created successfully');
    },
    onError: (err: unknown) => {
      Alert.alert('Error', getApiErrorMessage(err, 'Failed to create material'));
    },
  });

  const items = useMemo(() => parseApiListResponse<MaterialItem>(response), [response]);
  const loadErrorMessage = useMemo(
    () => getApiErrorMessage(error, 'Could not load materials. Pull to refresh.'),
    [error]
  );
  const hasActiveFilter = statusFilter !== 'all' || !!debouncedSearch.trim();
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const filterOptions = useMemo(
    () =>
      (['all', 'low', 'out'] as const).map((s) => ({
        value: s,
        label: s === 'out' ? 'Out of Stock' : s.charAt(0).toUpperCase() + s.slice(1),
      })),
    []
  );

  const openAddModal = useCallback(() => {
    setFormData({
      ...INITIAL_FORM,
      categoryId: categories[0]?.id || '',
    });
    setAddModalVisible(true);
  }, [categories]);

  const handleCreateMaterial = useCallback(() => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Item name is required');
      return;
    }
    createMutation.mutate();
  }, [formData.name, createMutation]);

  const handleItemPress = useCallback(
    (item: MaterialItem) => {
      router.push(`/material/${item.id}` as never);
    },
    [router]
  );

  if (!hasFeature('materials')) {
    return <FeatureAccessDenied message="Materials are not enabled for this workspace." />;
  }


  if (!isShop && !isPharmacy && !isStudio) {
    return (
      <FeatureAccessDenied message="Materials are available for shop, pharmacy, and studio workspaces. Equipment is managed on the web app." />
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
          <AppIcon name="chevron-right" size={14} color={mutedColor} />
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenShell style={styles.container}>
      {!isLoading && !isError && items.length > 0 && (
        <ListActionButton
          label="Add Material"
          onPress={openAddModal}
          backgroundColor={colors.tint}
        />
      )}

      {showListFilters(isLoading, isError, items.length, hasActiveFilter) && (
        <FilterChipRow options={filterOptions} value={statusFilter} onChange={setStatusFilter} />
      )}

      {isLoading && !response ? (
        <ListLoadingState message="Loading materials..." />
      ) : isError ? (
        <ListErrorState title="Failed to load materials" message={loadErrorMessage} onRetry={refetch} />
      ) : items.length === 0 ? (
        <ListEmptyState
          fill
          imageKey="MATERIALS"
          title={statusFilter === 'all' && !debouncedSearch.trim() ? 'No materials yet' : 'No matching materials'}
          subtitle={
            statusFilter === 'all' && !debouncedSearch.trim()
              ? 'Track raw materials and supplies for your operations'
              : 'Try adjusting your filters or search terms'
          }
          titleColor={textColor}
          subtitleColor={mutedColor}
        >
          {statusFilter === 'all' && !debouncedSearch.trim() ? (
            <EmptyStateActionButton
              label="Add Material"
              onPress={openAddModal}
              backgroundColor={colors.tint}
            />
          ) : null}
        </ListEmptyState>
      ) : (
        <FlatList
          style={flatListStyleForEmpty}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
        />
      )}

      <FormSheetModal
        visible={addModalVisible}
        title={FORM_LABELS.material.addTitle}
        onClose={() => setAddModalVisible(false)}
        cardBg={cardBg}
        borderColor={borderColor}
        textColor={textColor}
        mutedColor={mutedColor}
        footer={
          <Pressable
            onPress={handleCreateMaterial}
            disabled={createMutation.isPending}
            style={[
              styles.submitButton,
              { backgroundColor: colors.tint },
              createMutation.isPending && styles.submitButtonDisabled,
            ]}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>{FORM_LABELS.material.add}</Text>
            )}
          </Pressable>
        }
      >
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.material.itemName}</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="e.g. A4 Paper Ream"
                  placeholderTextColor={mutedColor}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.material.sku}</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="Optional SKU"
                  placeholderTextColor={mutedColor}
                  value={formData.sku}
                  onChangeText={(text) => setFormData({ ...formData, sku: text })}
                />
              </View>
              {categories.length > 0 && (
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.material.category}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {categories.map((cat) => (
                      <Pressable
                        key={cat.id}
                        onPress={() => setFormData({ ...formData, categoryId: cat.id })}
                        style={[
                          styles.chip,
                          {
                            borderColor,
                            backgroundColor: formData.categoryId === cat.id ? colors.tint : inputBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: formData.categoryId === cat.id ? '#fff' : textColor },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.material.unit}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {MATERIAL_UNITS.map((u) => (
                    <Pressable
                      key={u.value}
                      onPress={() => setFormData({ ...formData, unit: u.value })}
                      style={[
                        styles.chip,
                        {
                          borderColor,
                          backgroundColor: formData.unit === u.value ? colors.tint : inputBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: formData.unit === u.value ? '#fff' : textColor },
                        ]}
                      >
                        {u.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, styles.formHalf]}>
                  <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.material.quantityOnHand}</Text>
                  <TextInput
                    style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                    placeholder="0"
                    placeholderTextColor={mutedColor}
                    value={formData.quantityOnHand}
                    onChangeText={(text) => setFormData({ ...formData, quantityOnHand: text })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.formGroup, styles.formHalf]}>
                  <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.material.reorderLevel}</Text>
                  <TextInput
                    style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                    placeholder="0"
                    placeholderTextColor={mutedColor}
                    value={formData.reorderLevel}
                    onChangeText={(text) => setFormData({ ...formData, reorderLevel: text })}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>{FORM_LABELS.material.unitCost}</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder={`0.00 (${CURRENCY.SYMBOL})`}
                  placeholderTextColor={mutedColor}
                  value={formData.unitCost}
                  onChangeText={(text) => setFormData({ ...formData, unitCost: text })}
                  keyboardType="decimal-pad"
                />
              </View>
      </FormSheetModal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
  formRow: { flexDirection: 'row', gap: 12 },
  formHalf: { flex: 1 },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  chipScroll: { marginTop: 4, marginBottom: -4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
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
