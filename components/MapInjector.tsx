"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

export default function MapInjector() {
  useEffect(() => {
    const k = document.getElementById("kolkata-map");
    const p = document.getElementById("pandal-map");
    if (!k && !p) return;
    (async () => {
      const L = await import("leaflet");
      if (k) {
        const map = L.map(k as HTMLElement).setView([22.57, 88.36], 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);
        const res = await fetch("/points.json");
        const pts = await res.json();
        const g = L.featureGroup();
        for (const pt of pts) {
          const m = L.circleMarker([pt.lat, pt.lng], { radius: 4, color: "#D90429", fillColor: "#FFB800", fillOpacity: 0.9 });
          m.bindPopup(`<a href="/paras/${pt.slug}">${pt.name}</a>`);
          g.addLayer(m);
        }
        g.addTo(map);
        try { map.fitBounds(g.getBounds().pad(0.05)); } catch {}
      }
      if (p) {
        const lat = parseFloat(p.dataset.lat || "22.57");
        const lng = parseFloat(p.dataset.lng || "88.36");
        const map = L.map(p as HTMLElement).setView([lat, lng], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
        L.marker([lat, lng]).addTo(map);
      }
    })();
  }, []);
  return null;
}
