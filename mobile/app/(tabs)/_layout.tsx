import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/context/AuthContext';

import { Header } from '@/components/Header';
import Colors from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { resolveBusinessType, SHOP_TYPES } from '@/constants';

function TabBarIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -2 }} name={name} color={color} />;
}

function CenterTabButton() {
  const { activeTenant } = useAuth();
  const resolvedType = resolveBusinessType(activeTenant?.businessType);
  const isStudio = resolvedType === 'studio';

  return (
    <View style={styles.centerButton}>
      <FontAwesome
        name={isStudio ? 'plus' : 'camera'}
        size={28}
        color="#fff"
      />
    </View>
  );
}

export default function TabLayout() {
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const { activeTenant, user, hasFeature } = useAuth();
  const resolvedType = resolveBusinessType(activeTenant?.businessType);
  const isShop = resolvedType === 'shop';
  const isPharmacy = resolvedType === 'pharmacy';
  const isStudio = resolvedType === 'studio';
  const shopType = activeTenant?.metadata?.shopType;
  const isRestaurant = shopType === SHOP_TYPES.RESTAURANT;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerShown: true,
        header: () => <Header />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      {isRestaurant && hasFeature('orders') ? (
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Kitchen',
            tabBarIcon: ({ color }) => <TabBarIcon name="cutlery" color={color} />,
          }}
        />
      ) : (
        <Tabs.Screen
          name="orders"
          options={{ href: null }}
        />
      )}
      <Tabs.Screen
        name="products"
        options={{
          href: null, // Products accessible from More menu only
        }}
      />
      {isStudio && hasFeature('jobAutomation') ? (
        <Tabs.Screen
          name="jobs"
          options={{
            title: 'Jobs',
            tabBarIcon: ({ color }) => <TabBarIcon name="briefcase" color={color} />,
          }}
        />
      ) : (
        <Tabs.Screen
          name="jobs"
          options={{
            href: null, // Hide from tab bar for non-studio businesses
          }}
        />
      )}
      <Tabs.Screen
        name="scan"
        options={{
          title: isStudio ? 'Add' : 'Scan',
          tabBarButton: (props) => (
            <Pressable
              onPress={props.onPress}
              style={({ pressed }) => [
                styles.centerTab,
                pressed && styles.centerButtonPressed,
              ]}
            >
              <View style={styles.centerTabContent}>
                <CenterTabButton />
                <Text style={[styles.centerTabLabel, { color: colors.tabIconDefault }]}>
                  {isStudio ? 'Add' : 'Scan'}
                </Text>
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={
          hasFeature('crm')
            ? {
                title: 'Customers',
                tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="users" color={color} />,
              }
            : { href: null, title: 'Customers' }
        }
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <TabBarIcon name="bars" color={color} />,
        }}
      />
      {/* Hide these screens from tab bar but keep them accessible */}
      <Tabs.Screen
        name="chat"
        options={{
          href: null, // Chat accessible via header icon
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="materials"
        options={{
          href: null, // Hide from tab bar, accessible via More menu
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  centerTabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTabLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  centerButtonPressed: {
    opacity: 0.9,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
