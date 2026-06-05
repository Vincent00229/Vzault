// Vzault Service Worker - Cache-Only Strategy
// On first load: fetch from network AND cache.
// On subsequent loads: serve ONLY from cache. No network.

const CACHE_NAME = 'vzault-cache-v1';

// Core static assets (always pre-cached)
const PRE_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/lock-bg.jpg',
  '/main-bg.jpg',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches, claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Cache-Only for previously cached resources.
// On FIRST encounter: fetch from network, store in cache, then return.
// On ALL subsequent: return from cache ONLY.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Skip non-same-origin, extensions, blob/data
  if (url.origin !== self.location.origin) return;
  if (
    url.protocol === 'chrome-extension:' ||
    url.protocol === 'moz-extension:' ||
    url.protocol === 'blob:' ||
    url.protocol === 'data:'
  ) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Already cached → serve from cache ONLY (no network)
        return cached;
      }

      // First time seeing this resource → fetch from network, cache it, then return
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Network failed and not in cache → error
        console.error('[Vzault SW] Not in cache:', event.request.url);
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline - not cached', { status: 503 });
      });
    })
  );
});
