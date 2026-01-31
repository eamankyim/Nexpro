import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * usePushNotifications hook
 * Manages push notification subscription and permissions
 * @returns {Object} Push notification state and methods
 */
export const usePushNotifications = () => {
  const [permission, setPermission] = useState(Notification.permission);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 
                     'PushManager' in window && 
                     'Notification' in window;
    setIsSupported(supported);

    if (supported) {
      checkSubscription();
    }
  }, []);

  // Check current subscription status
  const checkSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
      setIsSubscribed(!!sub);
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      return { success: false, error: 'Push notifications not supported' };
    }

    setIsLoading(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        return { success: true, permission: result };
      }

      return { 
        success: false, 
        permission: result,
        error: result === 'denied' 
          ? 'Notification permission denied' 
          : 'Notification permission dismissed'
      };
    } catch (error) {
      console.error('[Push] Permission request failed:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      return { success: false, error: 'Push notifications not supported' };
    }

    if (permission !== 'granted') {
      const permResult = await requestPermission();
      if (!permResult.success) {
        return permResult;
      }
    }

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;

      // Check for existing subscription
      let sub = await registration.pushManager.getSubscription();

      if (!sub) {
        // Create new subscription
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      setSubscription(sub);
      setIsSubscribed(true);

      // Send subscription to server
      try {
        await api.post('/notifications/push-subscription', {
          subscription: sub.toJSON()
        });
      } catch (serverError) {
        console.error('[Push] Failed to save subscription to server:', serverError);
      }

      return { success: true, subscription: sub };
    } catch (error) {
      console.error('[Push] Subscription failed:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, permission, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!subscription) {
      return { success: true };
    }

    setIsLoading(true);

    try {
      await subscription.unsubscribe();
      setSubscription(null);
      setIsSubscribed(false);

      // Notify server
      try {
        await api.delete('/notifications/push-subscription');
      } catch (serverError) {
        console.error('[Push] Failed to remove subscription from server:', serverError);
      }

      return { success: true };
    } catch (error) {
      console.error('[Push] Unsubscribe failed:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [subscription]);

  // Show a local notification (for testing)
  const showLocalNotification = useCallback(async (title, options = {}) => {
    if (permission !== 'granted') {
      const permResult = await requestPermission();
      if (!permResult.success) {
        return permResult;
      }
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body: options.body || '',
        icon: options.icon || '/icons/icon-192x192.png',
        badge: options.badge || '/icons/badge-72x72.png',
        tag: options.tag || 'local-notification',
        data: options.data || {},
        vibrate: options.vibrate || [100, 50, 100],
        ...options
      });

      return { success: true };
    } catch (error) {
      console.error('[Push] Show notification failed:', error);
      return { success: false, error: error.message };
    }
  }, [permission, requestPermission]);

  return {
    isSupported,
    permission,
    isSubscribed,
    subscription,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe,
    showLocalNotification,
    checkSubscription
  };
};

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  if (!base64String) {
    console.warn('[Push] No VAPID public key configured');
    return new Uint8Array();
  }

  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default usePushNotifications;
