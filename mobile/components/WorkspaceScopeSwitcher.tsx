import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { useShopOptional } from '@/context/ShopContext';
import { useStudioLocationOptional } from '@/context/StudioLocationContext';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { refreshAfterSale } from '@/utils/queryInvalidation';

type ScopeOption = { id: string; label: string; isAll?: boolean };

type WorkspaceScopeSwitcherProps = {
  /** Render inside the header top row beside the avatar (no extra margin). */
  embedded?: boolean;
};

/**
 * Shop or studio location picker for the global header (web ShopSwitcher parity).
 */
export function WorkspaceScopeSwitcher({ embedded = false }: WorkspaceScopeSwitcherProps) {
  const shop = useShopOptional();
  const studio = useStudioLocationOptional();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const [open, setOpen] = useState(false);

  const config = useMemo(() => {
    if (shop?.isShopWorkspace && shop.shops.length > 0) {
      const options: ScopeOption[] = shop.shops.map((s) => ({
        id: s.id,
        label: s.isDefault ? `${s.name} (main)` : s.name,
      }));
      const label = shop.activeShop?.name || 'Select shop';
      const showPicker = shop.shops.length > 1;
      return {
        kind: 'shop' as const,
        icon: 'archive' as const,
        label,
        options,
        showPicker,
        loading: shop.loadingShops,
        activeId: shop.activeShopId,
        onSelect: (id: string) => shop.setActiveShop(id),
      };
    }
    if (studio?.isStudioWorkspace && studio.locations.length > 0) {
      const options: ScopeOption[] = [];
      if (studio.canAccessAll) options.push({ id: 'all', label: 'All locations', isAll: true });
      studio.locations.forEach((l) => {
        options.push({
          id: l.id,
          label: l.isDefault ? `${l.name} (main)` : l.name,
        });
      });
      const label =
        studio.activeLocation?.name ||
        (studio.canAccessAll ? 'All locations' : 'Select location');
      const showPicker = studio.locations.length > 1 || studio.canAccessAll;
      return {
        kind: 'studio' as const,
        icon: 'briefcase' as const,
        label,
        options,
        showPicker,
        loading: studio.loadingLocations,
        activeId: studio.activeStudioLocationId,
        onSelect: (id: string) => studio.setActiveStudioLocation(id === 'all' ? 'all' : id),
      };
    }
    return null;
  }, [shop, studio]);

  if (!config || config.loading) return null;

  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';

  const rowStyle = embedded
    ? [styles.staticRow, styles.embeddedRow]
    : styles.staticRow;

  if (!config.showPicker) {
    return (
      <View style={rowStyle}>
        <AppIcon name={config.icon} size={14} color={mutedColor} />
        <Text style={[styles.staticLabel, { color: textColor }]} numberOfLines={1}>
          {config.label}
        </Text>
      </View>
    );
  }

  const triggerStyle = embedded
    ? [styles.trigger, styles.embeddedTrigger]
    : styles.trigger;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [triggerStyle, pressed && styles.pressed]}
      >
        <AppIcon name={config.icon} size={14} color={mutedColor} />
        <Text style={[styles.triggerLabel, { color: textColor }]} numberOfLines={1}>
          {config.label}
        </Text>
        <AppIcon name="chevron-down" size={12} color={mutedColor} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: cardBg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: textColor }]}>
              {config.kind === 'shop' ? 'Select shop' : 'Select location'}
            </Text>
            <FlatList
              data={config.options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const active =
                  (item.isAll && !config.activeId) || item.id === config.activeId;
                return (
                  <Pressable
                    onPress={() => {
                      config.onSelect(item.id);
                      setOpen(false);
                    }}
                    style={[styles.option, active && { backgroundColor: `${colors.tint}18` }]}
                  >
                    <Text style={[styles.optionText, { color: active ? colors.tint : textColor }]}>
                      {item.label}
                    </Text>
                    {active ? <AppIcon name="check" size={16} color={colors.tint} /> : null}
                  </Pressable>
                );
              }}
            />
            <Pressable onPress={() => setOpen(false)} style={[styles.closeBtn, { borderColor: resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb' }]}>
              <Text style={{ color: textColor, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function OfflineQueueBanner() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { offlineQueueService } = await import('@/services/offlineQueueService');
      const n = await offlineQueueService.getPendingCount();
      if (mounted) setCount(n);
    };
    load();
    const interval = setInterval(load, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (count === 0) return null;

  const onSync = async () => {
    setSyncing(true);
    try {
      const { offlineQueueService } = await import('@/services/offlineQueueService');
      const { synced } = await offlineQueueService.syncPendingSales();
      setCount(await offlineQueueService.getPendingCount());
      if (synced > 0) await refreshAfterSale(queryClient);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={[bannerStyles.wrap, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
      <Text style={bannerStyles.text}>{count} sale(s) waiting to sync</Text>
      <Pressable onPress={onSync} disabled={syncing} style={[bannerStyles.btn, { backgroundColor: colors.tint }]}>
        {syncing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={bannerStyles.btnText}>Sync now</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  staticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 0,
    paddingVertical: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 44,
  },
  staticLabel: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 0,
    paddingVertical: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 44,
  },
  triggerLabel: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  embeddedRow: {
    marginBottom: 0,
    alignSelf: 'stretch',
    flex: 1,
    minWidth: 0,
  },
  embeddedTrigger: {
    marginBottom: 0,
    alignSelf: 'stretch',
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '55%',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  optionText: { fontSize: 16, flex: 1 },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
});

const bannerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  text: { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400e' },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
