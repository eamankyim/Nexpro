import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { resolveImageUrl } from '@/utils/fileUtils';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BackButton } from '@/components/BackButton';

type MenuItem = {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  route?: string;
  destructive?: boolean;
  onPress?: () => void;
};

export default function AccountScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  }, [logout, router]);

  const menuItems: MenuItem[] = [
    { id: 'profile', label: 'Profile', icon: 'user', route: '/profile' },
    { id: 'settings', label: 'Settings', icon: 'cog', route: '/settings' },
    { id: 'logout', label: 'Log out', icon: 'sign-out', destructive: true, onPress: handleLogout },
  ];

  const handleMenuPress = useCallback(
    (item: MenuItem) => {
      if (item.onPress) {
        item.onPress();
      } else if (item.route) {
        router.push(item.route as any);
      }
    },
    [router]
  );

  const bg = colorScheme === 'dark' ? colors.background : '#fff';
  const cardBg = colorScheme === 'dark' ? '#27272a' : '#f9fafb';
  const borderColor = colorScheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = colorScheme === 'dark' ? '#fff' : '#111';
  const mutedColor = colorScheme === 'dark' ? '#a1a1aa' : '#6b7280';

  return (
    <>
      {/* Header with back button */}
      <View style={[styles.header, { backgroundColor: bg, paddingTop: insets.top > 0 ? insets.top : 12 }]}>
        <BackButton />
      </View>
      <ScrollView
        style={[styles.container, { backgroundColor: bg }]}
        contentContainerStyle={styles.content}
      >
        {/* User summary */}
        <View style={[styles.userCard, { backgroundColor: cardBg, borderColor }]}>
          {user?.profilePicture ? (
            <Image
              source={{ uri: resolveImageUrl(user.profilePicture) }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.tint }]}>
              <FontAwesome name="user" size={28} color="#fff" />
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: textColor }]}>
              {user?.name || 'User'}
            </Text>
            <Text style={[styles.userEmail, { color: mutedColor }]}>
              {user?.email}
            </Text>
          </View>
        </View>

        {/* Menu items */}
        <View style={[styles.menuCard, { backgroundColor: cardBg, borderColor }]}>
          {menuItems.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => handleMenuPress(item)}
              style={({ pressed }) => [
                styles.menuItem,
                index > 0 && styles.menuItemBorder,
                { borderTopColor: borderColor },
                pressed && styles.menuItemPressed,
              ]}
            >
              <FontAwesome
                name={item.icon}
                size={20}
                color={item.destructive ? '#dc2626' : colors.tint}
              />
              <Text
                style={[
                  styles.menuLabel,
                  { color: item.destructive ? '#dc2626' : textColor },
                ]}
              >
                {item.label}
              </Text>
              {item.route && (
                <FontAwesome name="chevron-right" size={14} color={mutedColor} />
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    marginTop: 4,
  },
  menuCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuItemBorder: {
    borderTopWidth: 1,
  },
  menuItemPressed: {
    opacity: 0.7,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
});
