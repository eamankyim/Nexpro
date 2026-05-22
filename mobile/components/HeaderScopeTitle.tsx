import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';

import { AppIcon } from '@/components/AppIcon';
import { WorkspaceScopeSwitcher } from '@/components/WorkspaceScopeSwitcher';
import { useAuth } from '@/context/AuthContext';
import { useShopOptional } from '@/context/ShopContext';
import { useStudioLocationOptional } from '@/context/StudioLocationContext';
import { useTheme } from '@/context/ThemeContext';
import { useScopedWorkspaceName } from '@/hooks/useScopedWorkspaceName';
import {
  resolveHeaderPageTitle,
  shouldShowWorkspaceScopeInHeader,
} from '@/utils/headerTitle';

type HeaderScopeTitleProps = {
  embedded?: boolean;
};

/**
 * Header scope slot: workspace picker/name on primary tabs, page title elsewhere.
 */
export function HeaderScopeTitle({ embedded = true }: HeaderScopeTitleProps) {
  const pathname = usePathname();
  const { activeTenant } = useAuth();
  const { resolvedTheme } = useTheme();
  const shop = useShopOptional();
  const studio = useStudioLocationOptional();
  const scopedName = useScopedWorkspaceName('ABS');

  const showWorkspaceScope = shouldShowWorkspaceScopeInHeader(pathname);
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';
  const rowBg = resolvedTheme === 'dark' ? '#27272a' : '#f3f4f6';

  const rowStyle = embedded
    ? [styles.row, styles.embeddedRow, { borderColor, backgroundColor: rowBg }]
    : [styles.row, { borderColor, backgroundColor: rowBg }];

  const hasScopePicker =
    (shop?.isShopWorkspace && (shop.shops.length > 0 || shop.loadingShops)) ||
    (studio?.isStudioWorkspace && (studio.locations.length > 0 || studio.loadingLocations));

  if (showWorkspaceScope) {
    if (hasScopePicker) {
      return <WorkspaceScopeSwitcher embedded={embedded} />;
    }
    return (
      <View style={rowStyle}>
        <AppIcon name="briefcase" size={14} color={mutedColor} />
        <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
          {scopedName}
        </Text>
      </View>
    );
  }

  const pageTitle = resolveHeaderPageTitle(pathname, activeTenant?.businessType);

  return (
    <View style={rowStyle}>
      <Text style={[styles.pageTitle, { color: textColor }]} numberOfLines={1}>
        {pageTitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 10,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  embeddedRow: {
    marginBottom: 0,
    alignSelf: 'stretch',
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  pageTitle: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
});
