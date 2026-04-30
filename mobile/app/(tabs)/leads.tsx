import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { leadService } from '@/services/leadService';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/context/AuthContext';
import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';

const STATUS_OPTIONS = ['all', 'new', 'contacted', 'qualified', 'converted', 'lost'] as const;

type LeadRow = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: string;
  priority?: string;
};

export default function LeadsScreen() {
  const router = useRouter();
  const { activeTenantId, hasFeature } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '' });

  const debouncedSearch = useDebounce(searchText, 400);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['leads', activeTenantId, debouncedSearch, status],
    queryFn: async () =>
      leadService.getAll({
        page: 1,
        limit: 50,
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
      }),
    enabled: !!activeTenantId && hasFeature('leadPipeline'),
  });

  const leads: LeadRow[] = useMemo(() => {
    const raw = data?.data;
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const createMutation = useMutation({
    mutationFn: () =>
      leadService.create({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        company: form.company.trim() || undefined,
        status: 'new',
        priority: 'medium',
        source: 'manual',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setAddOpen(false);
      setForm({ name: '', email: '', phone: '', company: '' });
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) => {
      const msg = e?.response?.data?.message || e?.message || 'Try again';
      Alert.alert('Could not create lead', msg);
    },
  });

  const onRefresh = useCallback(() => refetch(), [refetch]);

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  const renderLead = ({ item }: { item: LeadRow }) => (
    <Pressable
      onPress={() => router.push(`/lead/${item.id}` as never)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardBg, borderColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowTop}>
        <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
          {item.name || 'Untitled'}
        </Text>
        <View style={[styles.badge, { borderColor: colors.tint }]}>
          <Text style={[styles.badgeText, { color: colors.tint }]}>{item.status || 'new'}</Text>
        </View>
      </View>
      {item.company || item.email || item.phone ? (
        <Text style={[styles.sub, { color: mutedColor }]} numberOfLines={2}>
          {[item.company, item.email, item.phone].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
    </Pressable>
  );

  if (!hasFeature('leadPipeline')) {
    return <FeatureAccessDenied message="Leads are not enabled for this workspace." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.toolbar, { borderBottomColor: borderColor }]}>
        <View style={[styles.searchWrap, { backgroundColor: resolvedTheme === 'dark' ? '#18181b' : '#f3f4f6', borderColor }]}>
          <FontAwesome name="search" size={16} color={mutedColor} style={styles.searchIcon} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search leads"
            placeholderTextColor={mutedColor}
            style={[styles.searchInput, { color: textColor }]}
            returnKeyType="search"
          />
        </View>
        <Pressable
          onPress={() => setAddOpen(true)}
          style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.tint }, pressed && { opacity: 0.9 }]}
        >
          <FontAwesome name="plus" size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
        {STATUS_OPTIONS.map((s) => {
          const active = status === s;
          return (
            <Pressable
              key={s}
              onPress={() => setStatus(s)}
              style={[
                styles.chip,
                { borderColor: active ? colors.tint : borderColor, backgroundColor: active ? `${colors.tint}22` : cardBg },
              ]}
            >
              <Text style={{ color: active ? colors.tint : textColor, fontWeight: '600', textTransform: 'capitalize' }}>
                {s}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading && !data ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.tint} />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item.id}
          renderItem={renderLead}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: mutedColor }]}>No leads yet. Tap + to add one.</Text>
          }
        />
      )}

      <Modal visible={addOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>New lead</Text>
            <TextInput
              placeholder="Name *"
              placeholderTextColor={mutedColor}
              value={form.name}
              onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
              style={[styles.input, { borderColor, color: textColor }]}
            />
            <TextInput
              placeholder="Email (optional)"
              placeholderTextColor={mutedColor}
              value={form.email}
              onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.input, { borderColor, color: textColor }]}
            />
            <TextInput
              placeholder="Phone (optional)"
              placeholderTextColor={mutedColor}
              value={form.phone}
              onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))}
              keyboardType="phone-pad"
              style={[styles.input, { borderColor, color: textColor }]}
            />
            <TextInput
              placeholder="Company (optional)"
              placeholderTextColor={mutedColor}
              value={form.company}
              onChangeText={(t) => setForm((f) => ({ ...f, company: t }))}
              style={[styles.input, { borderColor, color: textColor }]}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setAddOpen(false)} style={[styles.secondaryBtn, { borderColor }]}>
                <Text style={{ color: textColor, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!form.name.trim()) {
                    Alert.alert('Name required');
                    return;
                  }
                  createMutation.mutate();
                }}
                style={[styles.primaryBtn, { backgroundColor: colors.tint }]}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsScroll: { maxHeight: 52, flexGrow: 0 },
  chipsRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  listContent: { padding: 12, paddingBottom: 32 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  pressed: { opacity: 0.85 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 17, fontWeight: '600', flex: 1 },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  sub: { marginTop: 6, fontSize: 14 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  secondaryBtn: {
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  primaryBtn: {
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
