import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import {
  AppBottomSheet,
  APP_SHEET_HEIGHT_COMPACT,
  SheetMenuRow,
} from '@/components/AppBottomSheet';
import { useShopOptional } from '@/context/ShopContext';
import { useStudioLocationOptional } from '@/context/StudioLocationContext';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { FontFamily, FontSize } from '@/constants/typography';
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

      <AppBottomSheet
        visible={open}
        title={config.kind === 'shop' ? 'Select shop' : 'Select location'}
        onClose={() => setOpen(false)}
        height={APP_SHEET_HEIGHT_COMPACT}
      >
        {config.options.map((item) => {
          const active =
            (item.isAll && !config.activeId) || item.id === config.activeId;
          return (
            <SheetMenuRow
              key={item.id}
              label={item.label}
              active={active}
              onPress={() => {
                config.onSelect(item.id);
                setOpen(false);
              }}
              trailing={
                active ? <AppIcon name="check" size={18} color="#fff" /> : <View />
              }
            />
          );
        })}
      </AppBottomSheet>
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
  staticLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flexShrink: 1,
  },
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
  triggerLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flexShrink: 1,
  },
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
  text: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#92400e',
  },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnText: {
    color: '#fff',
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
