/**
 * ABS Service Worker (injectManifest)
 * Precaches app shell for installability and faster repeat visits.
 */
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// JS/CSS chunks: prefer network so deploys don't serve stale hashed assets from precache.
registerRoute(
  ({ request, url }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    (url.pathname.startsWith('/assets/') && /\.(js|css)$/i.test(url.pathname)),
  new NetworkFirst({
    cacheName: 'runtime-assets',
    networkTimeoutSeconds: 5,
    plugins: [
      {
        handlerDidError: async () => {
          const clients = await self.clients.matchAll({ type: 'window' });
          clients.forEach((client) => {
            client.postMessage({ type: 'CHUNK_LOAD_FAILED' });
          });
        },
      },
    ],
  })
);

self.addEventListener('install', () => {
  // PWAUpdatePrompt posts SKIP_WAITING when the user chooses to refresh
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
