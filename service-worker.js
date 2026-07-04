/* Swara Sadhana Basic — service worker (offline-capable PWA) */
const VERSION = 'swarasadhana-basic-v6';
const CORE_CACHE = VERSION + '-core';
const RUNTIME_CACHE = VERSION + '-runtime';

/* Same-origin assets precached on install. Paths are relative to the SW
   location (the bundle folder), so this works under any sub-path host. */
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/support.js',
  './assets/audio-engine.js',
  './assets/styles.css',
  './assets/app.js',
  './assets/images/favicon.png',
  './assets/images/apple-touch-icon.png',
  './assets/images/icon-192.png',
  './assets/images/icon-512.png',
  './assets/images/logo-white.png',
  './assets/images/logo.png',
  './assets/images/tanpura.png'
];

/* Cross-origin runtime deps cached the first time they load (React + Babel
   from unpkg, Google Fonts). After one online visit the app runs fully offline. */
const RUNTIME_HOSTS = [
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    // Cache individually so one failed request doesn't abort the whole install.
    await Promise.all(CORE_ASSETS.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k !== CORE_CACHE && k !== RUNTIME_CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isRuntimeHost = RUNTIME_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h));

  // Navigations: serve cached shell first, fall back to network, then index.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(CORE_CACHE);
        cache.put('./index.html', net.clone());
        return net;
      } catch (e) {
        return (await caches.match(req)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Same-origin assets: cache-first, update in background.
  if (sameOrigin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const net = await fetch(req);
        const cache = await caches.open(CORE_CACHE);
        cache.put(req, net.clone());
        return net;
      } catch (e) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // CDN / font deps: cache-first into the runtime cache.
  if (isRuntimeHost) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const net = await fetch(req);
        if (net && (net.ok || net.type === 'opaque')) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, net.clone());
        }
        return net;
      } catch (e) {
        return cached || Response.error();
      }
    })());
  }
});
