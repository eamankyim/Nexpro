import React, { useState, useCallback, useEffect } from 'react';
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

import { expenseService } from '@/services/expenseService';
import { useAuth } from '@/context/AuthContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { useTheme } from '@/context/ThemeContext';
import { CURRENCY } from '@/constants';
import Colors from '@/constants/Colors';

function formatCurrency(value: number | string | null | undefined): string {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value ?? 0)) || 0;
  return `${CURRENCY.SYMBOL} ${numValue.toFixed(CURRENCY.DECIMAL_PLACES)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type Expense = {
  id: string;
  description: string;
  amount: number;
  category?: string;
  categoryObj?: { id: string; name: string };
  date?: string;
  expenseDate?: string;
  paymentMethod?: string;
  notes?: string;
};

export default function ExpensesScreen() {
  const { activeTenantId, hasFeature } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const queryClient = useQueryClient();

  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    notes: '',
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['expenses', 'categories', activeTenantId],
    queryFn: () => expenseService.getCategories(),
    enabled: !!activeTenantId && hasFeature('expenses'),
    staleTime: 10 * 60 * 1000,
  });

  const categoryOptions = Array.isArray(categories) ? categories : [];
  const defaultCategory = categoryOptions[0] || 'Other';

  // Set default category when opening add modal and categories have loaded
  useEffect(() => {
    if (addModalVisible && !formData.category && defaultCategory) {
      setFormData((prev) => ({ ...prev, category: defaultCategory }));
    }
  }, [addModalVisible, defaultCategory]);

  const { data: response, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['expenses', activeTenantId],
    queryFn: () =>
      expenseService.getExpenses({
        page: 1,
        limit: 20,
      }),
    enabled: !!activeTenantId && hasFeature('expenses'),
    staleTime: 2 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data: {
      description: string;
      amount: number;
      category?: string;
      expenseDate: string;
      paymentMethod?: string;
      notes?: string;
    }) => expenseService.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setAddModalVisible(false);
      setFormData({
        description: '',
        amount: '',
        category: defaultCategory,
        expenseDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'cash',
        notes: '',
      });
      Alert.alert('Success', 'Expense recorded successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to record expense');
    },
  });

  const expenses = (response?.data || []) as Expense[];
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const handleExpensePress = useCallback((expense: Expense) => {
    setSelectedExpense(expense);
  }, []);

  const handleCreateExpense = useCallback(() => {
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Description is required');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    createExpenseMutation.mutate({
      description: formData.description.trim(),
      amount: parseFloat(formData.amount),
      category: formData.category || defaultCategory,
      expenseDate: formData.expenseDate,
      paymentMethod: formData.paymentMethod,
      notes: formData.notes.trim() || undefined,
    });
  }, [formData, createExpenseMutation, defaultCategory]);

  if (!hasFeature('expenses')) {
    return <FeatureAccessDenied message="Expenses are not enabled for this workspace." />;
  }

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';
  const inputBg = resolvedTheme === 'dark' ? '#18181b' : '#f9fafb';

  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <Pressable
      onPress={() => handleExpensePress(item)}
      style={({ pressed }) => [
        styles.expenseCard,
        { backgroundColor: cardBg, borderColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.expenseRow}>
        <View style={styles.expenseInfo}>
          <Text style={[styles.expenseDescription, { color: textColor }]} numberOfLines={1}>
            {item.description}
          </Text>
          {(item.category || (item as any).categoryObj?.name) && (
            <Text style={[styles.expenseCategory, { color: mutedColor }]}>
              {typeof item.category === 'string' ? item.category : (item as any).categoryObj?.name}
            </Text>
          )}
          <Text style={[styles.expenseDate, { color: mutedColor }]}>
            {formatDate(item.expenseDate ?? item.date ?? '')}
          </Text>
        </View>
        <Text style={[styles.expenseAmount, { color: '#ef4444' }]}>
          {formatCurrency(item.amount)}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Add expense button */}
      <Pressable
        onPress={() => setAddModalVisible(true)}
        style={[styles.addButton, { backgroundColor: colors.tint }]}
      >
        <FontAwesome name="plus" size={18} color="#fff" />
        <Text style={styles.addButtonText}>Add Expense</Text>
      </Pressable>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: mutedColor }]}>Loading expenses...</Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={renderExpenseItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="minus-circle" size={48} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No expenses yet</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                Record your first expense to track spending
              </Text>
            </View>
          }
        />
      )}

      {/* Expense detail modal */}
      <Modal
        visible={!!selectedExpense && !addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedExpense(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedExpense(null)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Expense Details</Text>
              <Pressable onPress={() => setSelectedExpense(null)} hitSlop={12}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            {selectedExpense && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Description</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {selectedExpense.description}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Amount</Text>
                  <Text style={[styles.detailValue, { color: '#ef4444', fontSize: 18, fontWeight: '700' }]}>
                    {formatCurrency(selectedExpense.amount)}
                  </Text>
                </View>
                {(selectedExpense.category || (selectedExpense as any).categoryObj) && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Category</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {typeof selectedExpense.category === 'string'
                        ? selectedExpense.category
                        : (selectedExpense as any).categoryObj?.name}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Date</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {formatDate(selectedExpense.expenseDate ?? selectedExpense.date ?? '')}
                  </Text>
                </View>
                {selectedExpense.paymentMethod && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Payment Method</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {selectedExpense.paymentMethod.replace('_', ' ')}
                    </Text>
                  </View>
                )}
                {selectedExpense.notes && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: mutedColor }]}>Notes</Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {selectedExpense.notes}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add expense modal */}
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
              <Text style={[styles.modalTitle, { color: textColor }]}>Add Expense</Text>
              <Pressable onPress={() => setAddModalVisible(false)} hitSlop={12}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Description *</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="Expense description"
                  placeholderTextColor={mutedColor}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Amount *</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="0.00"
                  placeholderTextColor={mutedColor}
                  value={formData.amount}
                  onChangeText={(text) => setFormData({ ...formData, amount: text })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {(categoryOptions.length > 0 ? categoryOptions : ['Other']).map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setFormData({ ...formData, category: cat })}
                      style={[
                        styles.categoryChip,
                        { borderColor, backgroundColor: (formData.category || defaultCategory) === cat ? colors.tint : inputBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          { color: (formData.category || defaultCategory) === cat ? '#fff' : textColor },
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Date</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={mutedColor}
                  value={formData.expenseDate}
                  onChangeText={(text) => setFormData({ ...formData, expenseDate: text })}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Payment Method</Text>
                <TextInput
                  style={[styles.formInput, { color: textColor, borderColor, backgroundColor: inputBg }]}
                  placeholder="cash, card, mobile_money"
                  placeholderTextColor={mutedColor}
                  value={formData.paymentMethod}
                  onChangeText={(text) => setFormData({ ...formData, paymentMethod: text })}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>Notes</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    { color: textColor, borderColor, backgroundColor: inputBg, minHeight: 80, textAlignVertical: 'top' },
                  ]}
                  placeholder="Additional notes (optional)"
                  placeholderTextColor={mutedColor}
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                  multiline
                />
              </View>
              <Pressable
                onPress={handleCreateExpense}
                disabled={createExpenseMutation.isPending}
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.tint },
                  createExpenseMutation.isPending && styles.submitButtonDisabled,
                ]}
              >
                {createExpenseMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Record Expense</Text>
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    padding: 14,
    borderRadius: 12,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  expenseCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  expenseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  expenseInfo: { flex: 1, marginRight: 12 },
  expenseDescription: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  expenseCategory: { fontSize: 12, marginBottom: 4 },
  expenseDate: { fontSize: 12 },
  expenseAmount: { fontSize: 18, fontWeight: '700' },
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
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  categoryScroll: { marginTop: 4, marginBottom: -4 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryChipText: { fontSize: 14, fontWeight: '500' },
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
