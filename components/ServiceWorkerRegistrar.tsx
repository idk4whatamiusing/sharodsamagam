"use client";

import { useEffect } from "react";

// Must match CACHE_VERSION in public/sw.js. Any cache not carrying this
// prefix belongs to an older build and is purged on load.
const CACHE_PREFIX = "sharodsamagam-v6";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          // Never let the HTTP cache hand back a stale worker script.
          updateViaCache: "none",
        });

        // Browsers only re-fetch sw.js about once every 24h. Without this
        // explicit check, a visitor can stay pinned to an old worker (and
        // its old caches) long after a deploy. `update()` forces the
        // byte-compare every visit.
        await reg.update();

        if (window.caches) {
          const keys = await window.caches.keys();
          await Promise.all(
            keys
              .filter((k) => !k.startsWith(CACHE_PREFIX))
              .map((k) => window.caches.delete(k))
          );
        }
      } catch {
        /* offline-capable enhancements are never fatal */
      }
    })();
  }, []);

  return null;
}