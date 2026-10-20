// Sharodsamagam service worker.
//
// Strategy per resource class:
//   - navigations      -> network-first, fall back to the cached shell offline
//   - /_next/static/*  -> cache-first (content-hashed, immutable)
//   - basemap tiles    -> cache-first, so re-visits cost nothing
//   - audio            -> cache-first
//   - everything else  -> network-first, fall back to cache
//
// Offline map downloads are deliberately not supported: prefetching tiles
// outside the current viewport is prohibited by OSMF's tile usage policy.
//
// Anything not matching CACHE_VERSION is deleted on activate, and the
// registrar component purges foreign caches on page load. A cache-first
// policy for *every* request (an earlier revision) pinned visitors to
// stale HTML and a stale /points.json indefinitely after a deploy.

const CACHE_VERSION = 'sharodsamagam-v7';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const TILE_CACHE = `${CACHE_VERSION}-tiles`;

const SHELL = ['/', '/map/', '/paras/', '/panzika/', '/chronicles/'];
const PRECACHE_URLS = ['/points.json', '/manifest.webmanifest'];

// Basemap tiles. OSMF's policy encourages keeping a local cache so repeat
// views do not re-download; it forbids prefetching, and that capability was
// removed from this worker. Nothing is ever fetched unless a map actually
// asks for that tile.
const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll is all-or-nothing; fetch individually so one 404 can't leave
      // the worker permanently uninstalled.
      await Promise.all(
        [...SHELL, ...PRECACHE_URLS].map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE && k !== TILE_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok && request.method === 'GET') cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Third-party basemap tiles: cache-first so panning back over ground the
  // user has already seen costs nothing and still works when flaky.
  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(TILE_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })()
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/Songs/') ||
    url.pathname.startsWith('/sounds/')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});