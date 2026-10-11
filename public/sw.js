// Sharodsamagam service worker.
//
// Strategy per resource class:
//   - navigations      -> network-first, fall back to the cached shell offline
//   - /_next/static/*  -> cache-first (content-hashed, immutable)
//   - /tiles/*         -> cache-first (addressed by z/x/y, stable)
//   - everything else  -> network-first, fall back to cache
//
// The previous version used cache-first for *every* request, which meant a
// visitor who loaded the site before a deploy kept getting the old HTML and
// the old /points.json from an orphaned cache forever. Old cache versions are
// now explicitly deleted on activate.

const CACHE_VERSION = 'sharodsamagam-v3';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

const SHELL = ['/', '/map/', '/paras/', '/panzika/', '/chronicles/'];

const PRECACHE_URLS = ['/points.json', '/manifest.webmanifest'];

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
        keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))
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
  if (url.origin !== self.location.origin) return; // let OSM tiles go straight to the network

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/tiles/') ||
    url.pathname.startsWith('/Songs/') ||
    url.pathname.startsWith('/sounds/')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});