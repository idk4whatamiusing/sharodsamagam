const CACHE_VERSION = 'sharodsamagam-offline-v1';
const TILE_CACHE = `${CACHE_VERSION}-tiles`;
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

const SHELL = ['/', '/map', '/paras', '/panzika', '/chronicles', '/points.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/tiles/')) {
    e.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
