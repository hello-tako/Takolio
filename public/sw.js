// Vite replaces this token with the immutable release SHA during production builds.
const BUILD_ID = '__TAKOSAN_BUILD_ID__';
const CACHE_NAME = `takosan-pwa-${BUILD_ID}`;

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/takolio/v1/app-icons/favicon.svg',
  '/takolio/v1/app-icons/icon-192.png',
  '/takolio/v1/app-icons/icon-512.png',
  '/takolio/v1/app-icons/icon-maskable-512.png',
  '/takolio/v1/logo/horizontal-primary.svg',
  '/takolio/v1/logo/symbol-primary.svg',
  '/takolio/v1/logo/symbol-micro.svg',
  '/takolio/v1/mascot/tako-welcome.svg',
  '/takolio/v1/mascot/tako-thinking.svg',
  '/takolio/v1/mascot/tako-cooking.svg',
  '/takolio/v1/mascot/tako-cheering.svg',
  '/takolio/v1/mascot/tako-completed.svg',
  '/takolio/v1/mascot/3d/tako-welcome-256.webp',
  '/takolio/v1/mascot/3d/tako-welcome-512.webp',
  '/takolio/v1/mascot/3d/tako-welcome-1024.webp',
  '/takolio/v1/mascot/3d/tako-thinking-256.webp',
  '/takolio/v1/mascot/3d/tako-thinking-512.webp',
  '/takolio/v1/mascot/3d/tako-cooking-256.webp',
  '/takolio/v1/mascot/3d/tako-cooking-512.webp',
  '/takolio/v1/mascot/3d/tako-cheering-256.webp',
  '/takolio/v1/mascot/3d/tako-cheering-512.webp',
  '/takolio/v1/logo/wordmark-primary.svg',
  '/takolio/v1/fonts/plus-jakarta-sans-vietnamese-latin-wght.woff2',
  '/takosan/v3/fonts/nunito-latin-wght-normal.woff2',
  '/takosan/v3/fonts/nunito-vietnamese-wght-normal.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const previousReleaseCaches = keys.filter(
        (key) => key.startsWith('takosan-pwa-') && key !== CACHE_NAME
      );

      await Promise.all(previousReleaseCaches.map((key) => caches.delete(key)));
      await self.clients.claim();

      if (previousReleaseCaches.length > 0) {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const sameOriginWindows = windows.filter(
          (client) => new URL(client.url).origin === self.location.origin
        );

        // Navigation cannot be awaited from activate: the new document fetch may wait
        // for activation to finish. Start it only after cache cleanup and client claim.
        sameOriginWindows.forEach((client) => {
          void client.navigate(client.url).catch((err) => {
            console.warn('Failed to refresh an existing client:', err);
          });
        });
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Third-party scripts must bypass the PWA entirely. Intercepting Google GIS
  // or Turnstile can leave Safari profiles stuck after a blocked network load.
  if (url.origin !== self.location.origin) return;

  // Static assets (images, fonts, css, js): Cache first, fallback to network
  if (
    url.pathname.startsWith('/frigo/') ||
    url.pathname.startsWith('/takosan/') ||
    url.pathname.startsWith('/takolio/') ||
    url.pathname.startsWith('/assets/')
  ) {
    // Recovery can serve the SPA shell at a missing chunk URL; never retain it as code.
    const expectedType = /\.m?js$/i.test(url.pathname)
      ? /^(?:text|application)\/(?:java|ecma)script(?:;|$)/i
      : /\.css$/i.test(url.pathname) ? /^text\/css(?:;|$)/i : null;
    const usable = (response) => response && (!expectedType || expectedType.test(response.headers.get('Content-Type') || ''));
    event.respondWith(
      caches.match(request).then((cached) => {
        if (usable(cached)) return cached;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && usable(networkResponse)) {
            const copy = networkResponse.clone();
            return caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch((err) => console.warn('Failed to cache static asset:', err))
              .then(() => networkResponse);
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Navigation requests: Network first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            return caches.open(CACHE_NAME)
              .then((cache) => cache.put('/index.html', copy))
              .catch((err) => console.warn('Failed to refresh app shell:', err))
              .then(() => response);
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error('Network unavailable and no cached response');
      })
  );
});
