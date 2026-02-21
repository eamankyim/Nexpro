import React, { useState, useCallback } from 'react';
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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { resolveImageUrl } from '@/utils/fileUtils';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BackButton } from '@/components/BackButton';

/**
 * Mobile header with search bar, notification bell, and user avatar.
 * Avatar links to account page (menu with Profile, Settings, etc.).
 */
const BACK_SCREENS = ['sales', 'expenses', 'invoices', 'quotes'];
const SCREEN_TITLES: Record<string, string> = {
  sales: 'Sales',
  expenses: 'Expenses',
  invoices: 'Invoices',
  quotes: 'Quotes',
};

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [searchValue, setSearchValue] = useState('');

  const showBack = BACK_SCREENS.some((s) => pathname?.includes(s));
  const backScreenTitle = BACK_SCREENS.find((s) => pathname?.includes(s));
  const screenTitle = backScreenTitle ? SCREEN_TITLES[backScreenTitle] : '';

  const handleBackPress = useCallback(() => {
    router.replace('/(tabs)/more');
  }, [router]);

  const handleSearchSubmit = useCallback(() => {
    const q = searchValue.trim();
    if (q) {
      router.push(`/(tabs)/customers?search=${encodeURIComponent(q)}` as any);
    }
  }, [searchValue, router]);

  const handleAvatarPress = useCallback(() => {
    router.push('/account');
  }, [router]);

  const handleChatPress = useCallback(() => {
    router.push('/(tabs)/chat');
  }, [router]);

  const handleNotificationPress = useCallback(() => {
    router.push('/notifications');
  }, [router]);

  const headerBg = colorScheme === 'dark' ? colors.background : '#fff';
  const borderColor = colorScheme === 'dark' ? '#27272a' : '#e5e7eb';
  const inputBg = colorScheme === 'dark' ? '#27272a' : '#f3f4f6';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';
  const placeholderColor = colorScheme === 'dark' ? '#a1a1aa' : '#9ca3af';

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
      {/* Row 1: Back/Avatar left, Title (when back), Chat & Notifications right */}
      <View style={styles.topRow}>
        {showBack ? (
          <BackButton onPress={handleBackPress} />
        ) : (
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
                <FontAwesome name="user" size={18} color="#fff" />
              </View>
            )}
          </Pressable>
        )}
        {showBack && screenTitle ? (
          <View style={styles.titleCenter}>
            <Text style={[styles.screenTitle, { color: textColor }]} numberOfLines={1}>
              {screenTitle}
            </Text>
          </View>
        ) : null}
        <View style={styles.topRowRight}>
          <Pressable
            onPress={handleChatPress}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
            hitSlop={8}
          >
            <FontAwesome name="comments" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={handleNotificationPress}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
            hitSlop={8}
          >
            <FontAwesome name="bell" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Row 2: Search bar */}
      <View style={[styles.searchContainer, { backgroundColor: inputBg }]}>
        <FontAwesome
          name="search"
          size={14}
          color={placeholderColor}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { color: textColor }]}
          placeholder="Search customers..."
          placeholderTextColor={placeholderColor}
          value={searchValue}
          onChangeText={setSearchValue}
          returnKeyType="search"
          onSubmitEditing={handleSearchSubmit}
        />
      </View>
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
  },
  topRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '600',
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
  },
  iconButtonPressed: {
    opacity: 0.7,
  },
  avatarButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
