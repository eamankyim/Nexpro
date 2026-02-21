import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { resolveBusinessType, SHOP_TYPES } from '@/constants';

type MenuItem = {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  route: string;
};

export default function MoreScreen() {
  const router = useRouter();
  const { activeTenant } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const resolvedType = resolveBusinessType(activeTenant?.businessType);
  const isShop = resolvedType === 'shop';
  const isPharmacy = resolvedType === 'pharmacy';
  const isStudio = resolvedType === 'studio';
  const shopType = activeTenant?.metadata?.shopType;
  const isRestaurant = shopType === SHOP_TYPES.RESTAURANT;

  const menuItems = useMemo(() => {
    const items: MenuItem[] = [];

    // Kitchen Orders in main tab for restaurants; Products in More
    if (isRestaurant) {
      items.push({ id: 'products', label: 'Products', icon: 'archive', route: '/(tabs)/products' });
    }

    // Financial / Operations - show based on business type
    if (isShop || isPharmacy) {
      items.push({ id: 'sales', label: 'Sales', icon: 'shopping-cart', route: '/(tabs)/sales' });
      items.push({ id: 'materials', label: 'Materials', icon: 'archive', route: '/(tabs)/materials' });
    }
    items.push({ id: 'expenses', label: 'Expenses', icon: 'minus-circle', route: '/(tabs)/expenses' });
    if (isShop || isPharmacy || isStudio) {
      items.push({ id: 'invoices', label: 'Invoices', icon: 'file-text', route: '/(tabs)/invoices' });
      items.push({ id: 'quotes', label: 'Quotes', icon: 'file-text-o', route: '/(tabs)/quotes' });
    }

    // Account
    items.push({ id: 'profile', label: 'Profile', icon: 'user', route: '/profile' });
    items.push({ id: 'settings', label: 'Settings', icon: 'cog', route: '/settings' });

    return items;
  }, [isShop, isPharmacy, isStudio, isRestaurant]);

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const borderColor = resolvedTheme === 'dark' ? '#3f3f46' : '#e5e7eb';
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
        {menuItems.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(item.route as any)}
            style={({ pressed }) => [
              styles.menuRow,
              index < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: resolvedTheme === 'dark' ? '#3f3f46' : '#f3f4f6' }]}>
              <FontAwesome name={item.icon} size={20} color={colors.tint} />
            </View>
            <Text style={[styles.menuLabel, { color: textColor }]}>{item.label}</Text>
            <FontAwesome name="chevron-right" size={14} color={mutedColor} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
});
