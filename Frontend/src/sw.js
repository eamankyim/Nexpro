/**
 * ABS Service Worker (injectManifest)
 * Precaches app shell for installability and faster repeat visits.
 */
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  // PWAUpdatePrompt posts SKIP_WAITING when the user chooses to refresh
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
