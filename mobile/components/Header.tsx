import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { AppIcon } from '@/components/AppIcon';
import { useAuth } from '@/context/AuthContext';
import { useSmartSearch } from '@/context/SmartSearchContext';
import { resolveImageUrl } from '@/utils/fileUtils';
import { resolveHeaderSearchConfig } from '@/utils/tabRouteSearch';
import { HeaderScopeTitle } from '@/components/HeaderScopeTitle';
import { OfflineQueueBanner } from '@/components/WorkspaceScopeSwitcher';
import { notificationService } from '@/services/notificationService';
import { useScreenColors } from '@/hooks/useScreenColors';

/**
 * Mobile header with global page-aware search, notifications, avatar, and shop scope.
 */
export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, activeTenantId } = useAuth();
  const { colors, headerBg, borderColor, inputBg, textColor, mutedColor } = useScreenColors();
  const { pageConfig, searchValue, setSearchValue } = useSmartSearch();

  const searchConfig = useMemo(
    () => resolveHeaderSearchConfig(pathname, pageConfig),
    [pathname, pageConfig]
  );

  const { data: notificationSummary } = useQuery({
    queryKey: ['notifications', 'summary', activeTenantId],
    queryFn: () => notificationService.getSummary(),
    enabled: !!activeTenantId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnMount: false,
  });
  const unreadCount = notificationSummary?.data?.unread ?? 0;

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
  }, [setSearchValue]);

  const handleAvatarPress = useCallback(() => {
    router.push('/account');
  }, [router]);

  const handleChatPress = useCallback(() => {
    router.push('/(tabs)/chat');
  }, [router]);

  const handleNotificationPress = useCallback(() => {
    router.push('/notifications');
  }, [router]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: headerBg,
          borderBottomColor: borderColor,
          paddingTop: insets.top > 0 ? insets.top : 12,
        },
      ]}
    >
      <View style={[styles.topRow, !searchConfig && styles.topRowCompact]}>
        <View style={styles.topRowLeft}>
          <Pressable
            onPress={handleAvatarPress}
            style={({ pressed }) => [
              styles.avatarButton,
              pressed && styles.iconButtonPressed,
            ]}
            hitSlop={8}
          >
            {user?.profilePicture ? (
              <Image
                source={{ uri: resolveImageUrl(user.profilePicture) }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.tint }]}>
                <AppIcon name="user" size={18} color="#fff" />
              </View>
            )}
          </Pressable>
          <View style={styles.scopeSlot}>
            <HeaderScopeTitle embedded />
          </View>
        </View>
        <View style={styles.topRowRight}>
          <Pressable
            onPress={handleChatPress}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            hitSlop={8}
          >
            <AppIcon name="comments" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={handleNotificationPress}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            hitSlop={8}
          >
            <AppIcon name="bell" size={22} color={colors.text} />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <OfflineQueueBanner />

      {searchConfig ? (
        <View style={[styles.searchContainer, { backgroundColor: inputBg }]}>
          <AppIcon name="search" size={14} color={mutedColor} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder={searchConfig.placeholder}
            placeholderTextColor={mutedColor}
            value={searchValue}
            onChangeText={setSearchValue}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel={searchConfig.placeholder}
          />
          {searchValue.length > 0 && Platform.OS === 'android' ? (
            <Pressable onPress={handleClearSearch} hitSlop={8} accessibilityLabel="Clear search">
              <AppIcon name="times-circle" size={16} color={mutedColor} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  topRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  scopeSlot: {
    flex: 1,
    minWidth: 0,
  },
  topRowCompact: {
    marginBottom: 0,
  },
  topRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  iconButtonPressed: {
    opacity: 0.7,
  },
  avatarButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
