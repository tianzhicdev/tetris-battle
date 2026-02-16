// Simple service worker for PWA offline support
const CACHE_NAME = 'tetris-battle-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Only cache safe GET requests on same-origin HTTP(S) assets.
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Avoid caching websocket-related or PartyKit routes.
  if (url.pathname.startsWith('/parties/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache only successful basic responses.
        if (response.ok && response.type === 'basic') {
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              return cache.put(event.request, responseToCache);
            })
            .catch(() => {
              // Ignore cache write failures; network response is still valid.
            });
        }

        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request);
      })
  );
});
