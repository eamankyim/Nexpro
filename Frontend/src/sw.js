/**
 * ABS Service Worker (injectManifest)
 * Workbox precache + API cache + offline fallback + push/sync/message
 */
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

const OFFLINE_URL = '/offline.html';
const API_CACHE_NAME = 'shopwise-api-v1';

// Precache app shell (manifest injected at build by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);

// API: network-first with cache fallback
registerRoute(
  ({ request, url }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new NetworkFirst({ cacheName: API_CACHE_NAME })
);

// Offline fallback for navigation
setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
  return Response.error();
});

// Prompt mode: wait for client SKIP_WAITING so user can choose when to refresh
self.addEventListener('install', () => {
  // Do not call skipWaiting() here; PWAUpdatePrompt will postMessage('SKIP_WAITING') on Refresh
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Push notification
 */
self.addEventListener('push', (event) => {
  let data = {
    title: 'ABS',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'default',
    data: {},
  };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      vibrate: [100, 50, 100],
      actions: data.actions || [],
      requireInteraction: data.requireInteraction || false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
    })
  );
});

/**
 * Background sync (offline queue - sales and other pending mutations)
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending' || event.tag === 'sync-sales') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_PENDING', tag: event.tag, timestamp: Date.now() });
        });
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CACHE_URLS' && event.data.payload) {
    caches.open('shopwise-v2').then((cache) => cache.addAll(event.data.payload));
  }
});
