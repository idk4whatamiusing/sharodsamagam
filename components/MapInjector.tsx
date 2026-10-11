"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

const KOLKATA: [number, number] = [22.57, 88.36];

// Esri World Street Map: no API key, unrestricted zoom, and no bulk-download
// policy to trip over. Note Esri's REST tile template takes {y} before {x},
// unlike the XYZ convention.
//
// (OpenStreetMap's own tile server is deliberately not used here: it
// returns HTTP 200 with an "Access blocked" placeholder tile to anything it
// considers abusive, and bulk-downloading for offline caches is explicitly
// outside their tile usage policy.)
const TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const TILE_OPTS = {
  maxZoom: 19,
  attribution:
    "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, NPS and FAO",
};

// Esri will happily serve tiles the browser has already seen, so the service
// worker keeps a cache-first copy for repeat views.

// A map that silently fails to draw is indistinguishable from a map that
// never initialised, which makes every support question a guessing game.
// This paints an explicit, recoverable notice instead.
function failureNotice(host: HTMLElement, detail: string, retry?: () => void) {
  if (host.querySelector("[data-map-error]")) return;
  const wrap = document.createElement("div");
  wrap.setAttribute("data-map-error", "");
  wrap.setAttribute("role", "alert");
  wrap.style.cssText =
    "position:absolute;inset:0;z-index:1200;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;gap:.5rem;padding:1rem;text-align:center;" +
    "background:repeating-linear-gradient(45deg,#FFFDF5,#FFFDF5 12px,#FFF6E5 12px,#FFF6E5 24px)";

  const title = document.createElement("p");
  title.style.cssText =
    "font:800 1rem/1.3 Georgia,serif;color:#2C1210;margin:0";
  title.textContent = "Map tiles could not be loaded";

  const body = document.createElement("p");
  body.style.cssText =
    "font:500 .8rem/1.5 system-ui,sans-serif;color:#2C1210;opacity:.7;margin:0;max-width:34ch";
  body.textContent = detail;

  wrap.append(title, body);

  if (retry) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Retry";
    btn.style.cssText =
      "margin-top:.25rem;padding:.5rem 1.1rem;border-radius:9999px;cursor:pointer;" +
      "font:700 .8rem/1 system-ui,sans-serif;color:#fff;background:#D90429;border:1px solid #FFB800";
    btn.onclick = () => {
      wrap.remove();
      retry();
    };
    wrap.append(btn);
  }

  host.append(wrap);
}

const BLOCKED_HINT =
  "A network filter or privacy shield may be blocking the map tile server. " +
  "Allow server.arcgisonline.com, then retry.";

export default function MapInjector() {
  useEffect(() => {
    const k = document.getElementById("kolkata-map");
    const p = document.getElementById("pandal-map");
    if (!k && !p) return;

    let disposed = false;

    (async () => {
      const L = await import("leaflet");
      if (disposed) return;

      // Leaflet resolves its default marker images through the CSS
      // `background-image` of .leaflet-default-icon-path, which resolves
      // relative to the *document* once the stylesheet is bundled. That
      // produced 404s for marker-icon.png on every pandal mini-map, so we
      // build a self-contained divIcon instead and never touch the assets.
      const pin = L.divIcon({
        className: "",
        html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#D90429;border:2px solid #FFB800;box-shadow:0 2px 6px rgba(0,0,0,.45)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -20],
      });

      // StrictMode double-invokes effects; without this the second L.map()
      // call throws "Map container is already initialized".
      const init = (el: HTMLElement, view: [number, number], zoom: number) => {
        const container = el as HTMLElement & { _leaflet_id?: number };
        if (container._leaflet_id != null) return null;
        return L.map(el).setView(view, zoom);
      };

      // Builds a tile layer that reports failure rather than failing silently.
      const tilesFor = (host: HTMLElement, map: import("leaflet").Map) => {
        const layer = L.tileLayer(TILE_URL, TILE_OPTS);
        let failures = 0;
        let reported = false;
        layer.on("tileerror", () => {
          failures += 1;
          // One bad tile is normal (edge of coverage); a run of them is not.
          if (reported || failures < 8) return;
          reported = true;
          failureNotice(host, BLOCKED_HINT, () => {
            failures = 0;
            reported = false;
            map.removeLayer(layer);
            tilesFor(host, map);
          });
        });
        layer.on("tileload", () => {
          failures = 0;
          host.querySelector("[data-map-error]")?.remove();
        });
        return layer.addTo(map);
      };

      if (k) {
        const map = init(k, KOLKATA, 12);
        if (!map) return;
        tilesFor(k, map);

        const res = await fetch("/points.json");
        const pts = (await res.json()) as {
          slug: string;
          name: string;
          lat: number | null;
          lng: number | null;
        }[];
        if (disposed) return;

        const g = L.featureGroup();
        for (const pt of pts) {
          if (pt.lat == null || pt.lng == null) continue;
          const m = L.circleMarker([pt.lat, pt.lng], {
            radius: 4,
            color: "#D90429",
            fillColor: "#FFB800",
            fillOpacity: 0.9,
          });
          m.bindPopup(
            `<a href="/paras/${pt.slug}">${pt.name}</a>`,
          );
          g.addLayer(m);
        }
        g.addTo(map);
        try {
          map.fitBounds(g.getBounds().pad(0.05));
        } catch {
          /* no geocoded points */
        }
      }

      if (p) {
        const lat = parseFloat(p.dataset.lat || String(KOLKATA[0]));
        const lng = parseFloat(p.dataset.lng || String(KOLKATA[1]));
        const map = init(p, [lat, lng], 15);
        if (!map) return;
        tilesFor(p, map);
        L.marker([lat, lng], { icon: pin }).addTo(map);
      }
    })().catch((err: unknown) => {
      // Progressive enhancement — but never fail silently.
      const host = k || p;
      if (!host) return;
      console.error("[map] initialisation failed", err);
      failureNotice(
        host,
        "The interactive map could not start in this browser. Everything else on the page still works.",
      );
    });

    return () => {
      disposed = true;
    };
  }, []);

  return null;
}