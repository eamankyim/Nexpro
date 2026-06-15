import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { STORAGE_KEYS } from '@/constants';
import { notificationService } from '@/services/notificationService';

export type PushRegistrationState = {
  status: 'idle' | 'skipped' | 'unsupported' | 'denied' | 'registered' | 'failed';
  message: string;
  updatedAt?: string;
  token?: string;
  canAskAgain?: boolean;
};

const DEFAULT_STATE: PushRegistrationState = {
  status: 'idle',
  message: 'Push notifications have not been checked yet.',
};

type NotificationData = Record<string, unknown>;
export type SellerNotificationRoute = '/(tabs)/online-orders' | '/(tabs)/products' | `/store-order/${string}`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const getPlatform = () => (Platform.OS === 'ios' ? 'ios' : 'android');

const asRecord = (value: unknown): NotificationData | null => (
  value && typeof value === 'object' && !Array.isArray(value) ? (value as NotificationData) : null
);

const getRouteId = (value: unknown) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

export function getSellerNotificationRoute(data: unknown): SellerNotificationRoute | null {
  const payload = asRecord(data);
  if (!payload) return null;

  const metadata = asRecord(payload.metadata);
  const link = typeof payload.link === 'string' ? payload.link : '';
  const source = metadata?.source;
  const saleId = getRouteId(payload.saleId) || getRouteId(metadata?.saleId);

  if (payload.type === 'order' && (source === 'online_store' || link.includes('/store/orders'))) {
    return saleId ? `/store-order/${encodeURIComponent(saleId)}` : '/(tabs)/online-orders';
  }

  if (payload.type === 'inventory' && (source === 'stock_alert' || link.includes('/products'))) {
    return '/(tabs)/products';
  }

  return null;
}

export function observeSellerNotificationResponses(onRoute: (route: SellerNotificationRoute) => void) {
  let isMounted = true;

  const handleResponse = (response: Notifications.NotificationResponse | null) => {
    if (!response || !isMounted) return;
    const route = getSellerNotificationRoute(response.notification.request.content.data);
    if (route) onRoute(route);
  };

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      handleResponse(response);
      if (response) return Notifications.clearLastNotificationResponseAsync();
      return undefined;
    })
    .catch(() => undefined);

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handleResponse(response);
    Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  });

  return () => {
    isMounted = false;
    subscription.remove();
  };
}

export async function getStoredPushRegistrationState() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_REGISTRATION_STATE);
    return raw ? ({ ...DEFAULT_STATE, ...JSON.parse(raw) } as PushRegistrationState) : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

async function persistPushRegistrationState(nextState: PushRegistrationState) {
  const state = { ...nextState, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(STORAGE_KEYS.PUSH_REGISTRATION_STATE, JSON.stringify(state));
  return state;
}

export async function registerPushNotifications({ prompt = false } = {}) {
  if (!Device.isDevice) {
    return persistPushRegistrationState({
      status: 'unsupported',
      message: 'Push notifications need a physical device.',
    });
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let finalPermission = existingPermission;

  if (existingPermission.status !== 'granted') {
    if (!prompt) {
      return persistPushRegistrationState({
        status: 'skipped',
        message: 'Enable push notifications from settings to receive real-time workspace alerts.',
        canAskAgain: existingPermission.canAskAgain,
      });
    }
    if (!existingPermission.canAskAgain) {
      return persistPushRegistrationState({
        status: 'denied',
        message: 'Notifications are blocked. Open device settings to allow alerts from ABS Ghana.',
        canAskAgain: false,
      });
    }
    finalPermission = await Notifications.requestPermissionsAsync();
  }

  if (finalPermission.status !== 'granted') {
    return persistPushRegistrationState({
      status: 'denied',
      message: finalPermission.canAskAgain
        ? 'Notifications were not enabled. You can try again when you are ready.'
        : 'Notifications are blocked. Open device settings to allow alerts from ABS Ghana.',
      canAskAgain: finalPermission.canAskAgain,
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await notificationService.registerPushToken({
      token: tokenData.data,
      platform: getPlatform(),
      deviceName: Device.modelName || undefined,
    });
    return persistPushRegistrationState({
      status: 'registered',
      message: 'This device is ready for workspace alerts.',
      token: tokenData.data,
      canAskAgain: true,
    });
  } catch (error) {
    return persistPushRegistrationState({
      status: 'failed',
      message: (error as { message?: string })?.message || 'Could not register this device for push alerts.',
      canAskAgain: true,
    });
  }
}
