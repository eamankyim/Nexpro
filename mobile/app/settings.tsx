import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { BackButton } from '@/components/BackButton';

export default function SettingsScreen() {
  const { memberships, activeTenantId, setActiveTenantId } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const handleSelectTenant = useCallback(
    async (tenantId: string) => {
      if (tenantId !== activeTenantId) {
        await setActiveTenantId(tenantId);
      }
    },
    [activeTenantId, setActiveTenantId]
  );

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  return (
    <>
      {/* Header with back button */}
      <View style={[styles.header, { backgroundColor: bg, paddingTop: insets.top > 0 ? insets.top : 12 }]}>
        <BackButton />
      </View>
      <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.content}>
        {/* Workspace switcher */}
        <Text style={[styles.sectionTitle, { color: textColor }]}>Workspace</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {memberships.length === 0 ? (
            <Text style={[styles.emptyText, { color: mutedColor }]}>No workspaces</Text>
          ) : (
            memberships.map((m) => {
              const isActive = m.tenantId === activeTenantId;
              const name = m.tenant?.name ?? `Workspace ${m.tenantId.slice(0, 8)}`;
              return (
                <Pressable
                  key={m.tenantId}
                  onPress={() => handleSelectTenant(m.tenantId)}
                  style={({ pressed }) => [
                    styles.tenantRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.tenantInfo}>
                    <Text style={[styles.tenantName, { color: textColor }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[styles.tenantType, { color: mutedColor }]}>
                      {m.tenant?.businessType ?? '—'}
                    </Text>
                  </View>
                  {isActive && (
                    <FontAwesome name="check-circle" size={22} color={colors.tint} />
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        {/* Theme preferences */}
        <Text style={[styles.sectionTitle, { color: textColor }]}>Preferences</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <Pressable
            onPress={() => setTheme('light')}
            style={({ pressed }) => [
              styles.prefRow,
              theme === 'light' && styles.prefRowActive,
              pressed && styles.pressed,
            ]}
          >
            <FontAwesome name="sun-o" size={20} color={theme === 'light' ? colors.tint : mutedColor} />
            <Text style={[styles.prefLabel, { color: textColor }]}>Light</Text>
            {theme === 'light' && <FontAwesome name="check-circle" size={20} color={colors.tint} />}
          </Pressable>
          <Pressable
            onPress={() => setTheme('dark')}
            style={({ pressed }) => [
              styles.prefRow,
              theme === 'dark' && styles.prefRowActive,
              pressed && styles.pressed,
            ]}
          >
            <FontAwesome name="moon-o" size={20} color={theme === 'dark' ? colors.tint : mutedColor} />
            <Text style={[styles.prefLabel, { color: textColor }]}>Dark</Text>
            {theme === 'dark' && <FontAwesome name="check-circle" size={20} color={colors.tint} />}
          </Pressable>
          <Pressable
            onPress={() => setTheme('system')}
            style={({ pressed }) => [
              styles.prefRow,
              theme === 'system' && styles.prefRowActive,
              pressed && styles.pressed,
            ]}
          >
            <FontAwesome name="circle-o" size={20} color={theme === 'system' ? colors.tint : mutedColor} />
            <Text style={[styles.prefLabel, { color: textColor }]}>System</Text>
            {theme === 'system' && <FontAwesome name="check-circle" size={20} color={colors.tint} />}
          </Pressable>
        </View>

        {/* Notification preferences */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.prefRow}>
            <FontAwesome name="bell" size={20} color={mutedColor} />
            <Text style={[styles.prefLabel, { color: textColor }]}>Notifications</Text>
            <Text style={[styles.prefHint, { color: mutedColor }]}>On</Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 8 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tenantInfo: { flex: 1 },
  tenantName: { fontSize: 16, fontWeight: '600' },
  tenantType: { fontSize: 13, marginTop: 2 },
  emptyText: { padding: 20, fontSize: 15 },
  pressed: { opacity: 0.8 },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  prefLabel: { flex: 1, fontSize: 16 },
  prefHint: { fontSize: 14 },
  prefRowActive: { backgroundColor: '#f3f4f6' },
});
