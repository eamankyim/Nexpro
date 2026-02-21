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
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { customerService } from '@/services/customerService';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';

type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
};

export default function CustomersScreen() {
  const params = useLocalSearchParams<{ search?: string; add?: string }>();
  const { activeTenantId } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState(params.search ?? '');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(params.add === '1');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '' });

  useEffect(() => {
    if (params.search) setSearchText(params.search);
    if (params.add === '1') setAddModalVisible(true);
  }, [params.search, params.add]);

  const debouncedSearch = useDebounce(searchText, 400);

  const { data: response, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['customers', activeTenantId, debouncedSearch],
    queryFn: () =>
      customerService.getCustomers({
        page: 1,
        limit: 20,
        search: debouncedSearch || undefined,
      }),
    enabled: !!activeTenantId,
    staleTime: 3 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (d: { name: string; email: string; phone?: string; company?: string }) =>
      customerService.createCustomer(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setAddModalVisible(false);
      setFormData({ name: '', email: '', phone: '', company: '' });
    },
    onError: (err: Error) => {
      Alert.alert('Error', err?.message ?? 'Failed to add customer');
    },
  });

  // Match web app pattern: response.data || []
  const customers = (response?.data || []) as Customer[];
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const handleAddCustomer = useCallback(() => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    if (!formData.email.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }
    createMutation.mutate({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim() || undefined,
      company: formData.company.trim() || undefined,
    });
  }, [formData, createMutation]);

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const inputBg = resolvedTheme === 'dark' ? '#27272a' : '#f3f4f6';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  const renderCustomerItem = ({ item }: { item: Customer }) => (
    <Pressable
      onPress={() => setSelectedCustomer(item)}
      style={({ pressed }) => [
        styles.customerCard,
        { backgroundColor: cardBg, borderColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.customerRow}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.tint }]}>
          <Text style={styles.avatarText}>
            {(item.name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={[styles.customerName, { color: textColor }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.customerEmail, { color: mutedColor }]} numberOfLines={1}>
            {item.email || item.phone || '—'}
          </Text>
        </View>
        <FontAwesome name="chevron-right" size={14} color={mutedColor} />
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: inputBg }]}>
        <FontAwesome name="search" size={16} color={mutedColor} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: textColor }]}
          placeholder="Search customers..."
          placeholderTextColor={mutedColor}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Add customer FAB */}
      <Pressable
        onPress={() => setAddModalVisible(true)}
        style={[styles.fab, { backgroundColor: colors.tint }]}
      >
        <FontAwesome name="plus" size={24} color="#fff" />
      </Pressable>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          renderItem={renderCustomerItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="users" size={48} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No customers</Text>
              <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
                Add your first customer
              </Text>
            </View>
          }
        />
      )}

      {/* Detail modal */}
      <Modal
        visible={!!selectedCustomer}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedCustomer(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedCustomer(null)}>
          <Pressable style={[styles.modalContent, { backgroundColor: cardBg }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                {selectedCustomer?.name}
              </Text>
              <Pressable onPress={() => setSelectedCustomer(null)} hitSlop={12}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            {selectedCustomer && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Email</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {selectedCustomer.email || '—'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Phone</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {selectedCustomer.phone || '—'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: mutedColor }]}>Company</Text>
                  <Text style={[styles.detailValue, { color: textColor }]}>
                    {selectedCustomer.company || '—'}
                  </Text>
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add customer modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAddModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: cardBg }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Add customer</Text>
              <Pressable onPress={() => setAddModalVisible(false)} hitSlop={12}>
                <FontAwesome name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: mutedColor }]}>Name *</Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor }]}
                placeholder="Customer name"
                placeholderTextColor={mutedColor}
                value={formData.name}
                onChangeText={(t) => setFormData((p) => ({ ...p, name: t }))}
              />
              <Text style={[styles.inputLabel, { color: mutedColor }]}>Email *</Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor }]}
                placeholder="email@example.com"
                placeholderTextColor={mutedColor}
                value={formData.email}
                onChangeText={(t) => setFormData((p) => ({ ...p, email: t }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={[styles.inputLabel, { color: mutedColor }]}>Phone</Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor }]}
                placeholder="Phone number"
                placeholderTextColor={mutedColor}
                value={formData.phone}
                onChangeText={(t) => setFormData((p) => ({ ...p, phone: t }))}
                keyboardType="phone-pad"
              />
              <Text style={[styles.inputLabel, { color: mutedColor }]}>Company</Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor }]}
                placeholder="Company name"
                placeholderTextColor={mutedColor}
                value={formData.company}
                onChangeText={(t) => setFormData((p) => ({ ...p, company: t }))}
              />
              <Pressable
                onPress={handleAddCustomer}
                disabled={createMutation.isPending}
                style={[styles.submitBtn, { backgroundColor: colors.tint }]}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Add customer</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    minHeight: 44,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  listContent: { paddingHorizontal: 16, paddingBottom: 80 },
  customerCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  customerRow: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: '600' },
  customerEmail: { fontSize: 14, marginTop: 2 },
  pressed: { opacity: 0.8 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  detailRow: { marginBottom: 16 },
  detailLabel: { fontSize: 12, marginBottom: 4 },
  detailValue: { fontSize: 16, fontWeight: '500' },
  inputLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  submitBtn: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
