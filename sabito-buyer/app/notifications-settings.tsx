import { useMutation, useQuery } from '@tanstack/react-query';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { BRAND } from '@/constants';
import { notificationsApi } from '@/services/ordersApi';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function NotificationsSettingsScreen() {
  const { isAuthenticated } = useAuth();
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);

  const prefsQuery = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => notificationsApi.getPreferences(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    const prefs = prefsQuery.data?.data;
    if (prefs) {
      setOrderUpdates(prefs.orderUpdates !== false);
      setPromotions(prefs.promotions === true);
    }
  }, [prefsQuery.data]);

  const savePrefs = useMutation({
    mutationFn: () => notificationsApi.updatePreferences({ orderUpdates, promotions }),
    onSuccess: () => Alert.alert('Preferences saved'),
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const tokenData = await Notifications.getExpoPushTokenAsync();
      await notificationsApi.register({
        token: tokenData.data,
        platform: Device.osName === 'iOS' ? 'ios' : 'android',
        deviceName: Device.modelName || undefined,
      });
    })().catch(() => undefined);
  }, [isAuthenticated]);

  return (
    <Screen style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Order updates</Text>
        <Switch
          value={orderUpdates}
          onValueChange={(v) => {
            setOrderUpdates(v);
            savePrefs.mutate();
          }}
          trackColor={{ true: BRAND.primary }}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Promotions</Text>
        <Switch
          value={promotions}
          onValueChange={(v) => {
            setPromotions(v);
            savePrefs.mutate();
          }}
          trackColor={{ true: BRAND.primary }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  label: { fontWeight: '600', color: BRAND.text },
});
