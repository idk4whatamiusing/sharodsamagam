"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type Point = { lat: number; lng: number; name: string; slug?: string };

export default function MapView({ points, height = 480 }: { points: Point[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current) return;
      map = L.map(ref.current).setView([22.57, 88.36], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      const group = L.featureGroup();
      for (const p of points) {
        const m = L.circleMarker([p.lat, p.lng], {
          radius: 5,
          color: "#D90429",
          fillColor: "#FFB800",
          fillOpacity: 0.9,
        });
        m.bindPopup(
          p.slug
            ? `<a href="/paras/${p.slug}" style="font-weight:700">${p.name}</a>`
            : `<b>${p.name}</b>`
        );
        group.addLayer(m);
      }
      group.addTo(map);
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 15);
      } else if (points.length > 1) {
        try { map.fitBounds(group.getBounds().pad(0.1)); } catch {}
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);

  return <div ref={ref} style={{ height, width: "100%" }} className="rounded-2xl border border-[#EAD5A0]" />;
}
