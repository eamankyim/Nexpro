import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { useAuth } from '@/context/AuthContext';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { resolveBusinessType, SHOP_TYPES, isQuotesEnabledForTenant } from '@/constants';

type MenuItem = {
  id: string;
  label: string;
  icon: AppIconName;
  route: string;
};

export default function MoreScreen() {
  const router = useRouter();
  const { activeTenant, hasFeature, user, isDriver } = useAuth();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor, resolvedTheme } = useScreenColors();
  const resolvedType = resolveBusinessType(activeTenant?.businessType);
  const isShop = resolvedType === 'shop';
  const isPharmacy = resolvedType === 'pharmacy';
  const isStudio = resolvedType === 'studio';
  const shopType = activeTenant?.metadata?.shopType;
  const isRestaurant = shopType === SHOP_TYPES.RESTAURANT;

  const menuItems = useMemo(() => {
    if (isDriver) {
      const driverItems: MenuItem[] = [
        { id: 'deliveries', label: 'My Deliveries', icon: 'truck', route: '/(tabs)/deliveries' },
        { id: 'profile', label: 'Profile', icon: 'user', route: '/profile' },
        { id: 'account', label: 'Account & logout', icon: 'sign-out', route: '/account' },
      ];
      return driverItems;
    }

    const items: MenuItem[] = [];
    const bt = activeTenant?.businessType;
    const quotesOk =
      hasFeature('quoteAutomation') && isQuotesEnabledForTenant(bt, shopType);

    if ((isShop || isPharmacy) && hasFeature('products')) {
      items.push({ id: 'products', label: 'Products', icon: 'shopping-cart', route: '/(tabs)/products' });
    }
    if ((isShop || isPharmacy) && hasFeature('paymentsExpenses')) {
      items.push({ id: 'sales', label: 'Sales', icon: 'shopping-cart', route: '/(tabs)/sales' });
      items.push({ id: 'store', label: 'Online store', icon: 'shopping-cart', route: '/(tabs)/store' });
      items.push({ id: 'online-orders', label: 'Online orders', icon: 'package', route: '/(tabs)/online-orders' });
    }
    if (isStudio && hasFeature('paymentsExpenses')) {
      items.push({ id: 'store', label: 'Studio store', icon: 'shopping-cart', route: '/(tabs)/store' });
      items.push({ id: 'store-services', label: 'Studio services', icon: 'cut-outline', route: '/(tabs)/store-services' });
    }
    if (isRestaurant && hasFeature('orders')) {
      items.push({ id: 'orders', label: 'Orders', icon: 'cutlery', route: '/(tabs)/orders' });
    }
    if (hasFeature('expenses')) {
      items.push({ id: 'expenses', label: 'Expenses', icon: 'minus-circle', route: '/(tabs)/expenses' });
    }
    // Invoices are in the main tab bar for shops and studios when the feature is enabled
    if (isStudio && hasFeature('jobAutomation')) {
      items.push({ id: 'jobs', label: 'Jobs', icon: 'briefcase', route: '/(tabs)/jobs' });
    }
    if ((isShop || isPharmacy || isStudio) && quotesOk) {
      items.push({ id: 'quotes', label: 'Quotes', icon: 'file-text-o', route: '/(tabs)/quotes' });
    }

    if (hasFeature('leadPipeline')) {
      items.push({ id: 'leads', label: 'Leads', icon: 'user-plus', route: '/(tabs)/leads' });
    }
    if (hasFeature('jobAutomation') && user?.isPlatformAdmin !== true) {
      items.push({ id: 'tasks', label: 'Tasks', icon: 'list', route: '/(tabs)/tasks' });
    }
    if (hasFeature('deliveries')) {
      items.push({ id: 'deliveries', label: 'Deliveries', icon: 'truck', route: '/(tabs)/deliveries' });
    }

    items.push({ id: 'profile', label: 'Profile', icon: 'user', route: '/profile' });
    items.push({ id: 'settings', label: 'Settings', icon: 'cog', route: '/settings' });

    return items;
  }, [isDriver, isShop, isPharmacy, isStudio, isRestaurant, hasFeature, activeTenant?.businessType, shopType, user?.isPlatformAdmin]);


  return (
    <ScreenShell scrollable contentContainerStyle={styles.content} style={styles.container}>
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
              <AppIcon name={item.icon} size={20} color={colors.tint} />
            </View>
            <Text style={[styles.menuLabel, { color: textColor }]}>{item.label}</Text>
            <AppIcon name="chevron-right" size={14} color={mutedColor} />
          </Pressable>
        ))}
      </View>
    </ScreenShell>
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
