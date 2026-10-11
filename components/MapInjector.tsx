"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

const KOLKATA: [number, number] = [22.57, 88.36];
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR = "&copy; OpenStreetMap contributors";

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

      if (k) {
        const map = init(k, KOLKATA, 12);
        if (!map) return;
        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(map);

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
        L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(map);
        L.marker([lat, lng], { icon: pin }).addTo(map);
      }
    })().catch(() => {
      /* map is progressive enhancement — never break the page over it */
    });

    return () => {
      disposed = true;
    };
  }, []);

  return null;
}