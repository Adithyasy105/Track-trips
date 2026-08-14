/* TripSync PWA worker: static assets only. Never caches API or authenticated data. */
// Bump this whenever PWA metadata/assets change so browsers discard stale
// manifests and favicon declarations from an older worker.
const CACHE_NAME = 'tripsync-static-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/tripsync-192.png',
  '/icons/tripsync-512.png',
  '/icons/tripsync-512-maskable.png',
  '/icons/apple-touch-icon.png',
  '/screenshots/tripsync-mobile.png',
  '/screenshots/tripsync-desktop.png',
];

const isApiOrAuthenticated = (request, url) =>
  url.pathname.startsWith('/api/') || request.headers.has('Authorization') || request.credentials === 'include';

const isSafeStaticAsset = (url) =>
  url.pathname.startsWith('/static/') ||
  url.pathname.startsWith('/icons/') ||
  url.pathname.startsWith('/screenshots/') ||
  ['/favicon.ico', '/manifest.json', '/offline.html'].includes(url.pathname);

self.addEventListener('install', (event) => {
  event.waitUntil(self.caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => self.caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Always refresh HTML and PWA metadata so SEO/PWA updates are not hidden
  // behind an older app-shell cache.
  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/manifest.json')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }
  if (request.method !== 'GET' || url.origin !== self.location.origin || isApiOrAuthenticated(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await self.caches.match('/index.html')) || self.caches.match('/offline.html'))
    );
    return;
  }

  if (!isSafeStaticAsset(url)) return;

  event.respondWith(
    self.caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          self.caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
