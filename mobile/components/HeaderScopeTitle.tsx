import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';

import { AppIcon } from '@/components/AppIcon';
import { WorkspaceScopeSwitcher } from '@/components/WorkspaceScopeSwitcher';
import { useAuth } from '@/context/AuthContext';
import { useShopOptional } from '@/context/ShopContext';
import { useStudioLocationOptional } from '@/context/StudioLocationContext';
import { useSmartSearch } from '@/context/SmartSearchContext';
import { useTheme } from '@/context/ThemeContext';
import { useScopedWorkspaceName } from '@/hooks/useScopedWorkspaceName';
import {
  resolveHeaderPageTitle,
  shouldShowWorkspaceScopeInHeader,
} from '@/utils/headerTitle';
import { FontFamily, FontSize } from '@/constants/typography';

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
  const { pageConfig } = useSmartSearch();

  const showWorkspaceScope = shouldShowWorkspaceScopeInHeader(pathname);
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  const rowStyle = embedded
    ? [styles.row, styles.embeddedRow]
    : styles.row;

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

  const pageTitle =
    pageConfig?.title || resolveHeaderPageTitle(pathname, activeTenant?.businessType);
  const subtitle = pageConfig?.subtitle?.trim() || '';

  return (
    <View style={[rowStyle, styles.titleCol]}>
      <Text style={[styles.pageTitle, { color: textColor }]} numberOfLines={1}>
        {pageTitle}
      </Text>
      {subtitle ? (
        <Text style={[styles.pageSubtitle, { color: mutedColor }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
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
  embeddedRow: {
    marginBottom: 0,
    alignSelf: 'stretch',
    flex: 1,
    minWidth: 0,
  },
  titleCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 1,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flexShrink: 1,
  },
  pageTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    fontWeight: '700',
    flexShrink: 1,
  },
  pageSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    fontWeight: '500',
    flexShrink: 1,
  },
});
