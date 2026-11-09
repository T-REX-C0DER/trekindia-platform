/**
 * TrekIndia — Service Worker (sw.js)
 * Caches core visual shells, styles, scripts, and serves offline trek guides seamlessly
 */

const CACHE_NAME = 'trekindia-shell-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/trek-detail.html',
  '/profile.html',
  '/style.css',
  '/map.css',
  '/profile.css',
  '/auth-client.js',
  '/offline-storage.js',
  '/whitebg_logo_processed.png',
  '/darkbg_logo_processed.png',
  '/Nature.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[ServiceWorker] Some pre-cache assets could not be loaded:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Network-first for dynamic API routes, with graceful fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        // Return structured offline JSON response if network fails
        return new Response(
          JSON.stringify({
            success: false,
            offline: true,
            message: 'You are currently offline. Accessing cached local guides.'
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        // If offline and request is an HTML page, fallback to cached trek-detail or index
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match(event.request).then(page => page || caches.match('/trek-detail.html'));
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});

