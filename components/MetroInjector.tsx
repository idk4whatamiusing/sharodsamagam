"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import "leaflet/dist/leaflet.css";
import metro from "../data/metro.json";

/**
 * Mounts the Kolkata transit network into the guide pages.
 *
 * Built imperatively against the `[data-metro-map]` slot that lib/metroInject
 * leaves in the mirrored HTML, which is how MapInjector handles the site-wide
 * map. React cannot own that node - it arrives inside
 * dangerouslySetInnerHTML - so the map and its legend are constructed here and
 * appended into it.
 *
 * Data is data/metro.json, harvested from the original by
 * scripts/harvest-metro.mjs. The coordinates are theirs, inverted from the
 * original's own Leaflet pixel space; nothing here is geocoded or approximated.
 */

type Line = {
  color: string;
  weight: number;
  name: string;
  bn: string;
  route: string;
  geometry: [number, number][];
};

type Station = {
  name: string;
  bn: string;
  kind: "metro" | "rail";
  lines: string[];
  latlng: [number, number];
  detail: string;
};

const LINES = metro.lines as Line[];
const STATIONS = metro.stations as Station[];
const METRO = STATIONS.filter((s) => s.kind === "metro");
const RAIL = STATIONS.filter((s) => s.kind === "rail");

/** Distinct places per line, matching the corridor cards' own counts: the
 *  original draws one pin per line at an interchange, so counting pins would
 *  report Noapara, Esplanade and Kavi Subhas twice. */
const countFor = (line: string) =>
  new Set(METRO.filter((s) => s.lines.includes(line)).map((s) => s.name)).size;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function legendHtml(): string {
  const swatch = (c: string) =>
    `<span style="display:inline-block;height:4px;width:24px;border-radius:999px;background:${c}"></span>`;
  const line = LINES.map(
    (l) =>
      `<span style="display:inline-flex;align-items:center;gap:6px">${swatch(l.color)}` +
      `<span style="font-size:11px;font-weight:700;color:#2C1210">${escapeHtml(l.name)}</span>` +
      `<span style="font-size:10px;font-family:ui-monospace,monospace;color:rgba(44,18,16,.55)">${countFor(l.name)}</span></span>`
  ).join("");
  return (
    `<div data-metro-legend style="position:absolute;inset:auto 0 0 0;z-index:400;padding:12px;pointer-events:none">` +
    `<div style="pointer-events:auto;display:inline-flex;max-width:100%;flex-wrap:wrap;align-items:center;gap:8px 16px;` +
    `border:1px solid #E5C880;border-radius:16px;background:rgba(255,255,255,.95);padding:12px 16px;` +
    `box-shadow:0 10px 24px -8px rgba(0,0,0,.25);backdrop-filter:blur(6px)">` +
    `<span style="font-size:10px;font-family:ui-monospace,monospace;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(44,18,16,.6)">5 Lines</span>` +
    line +
    `<span style="margin-left:auto;font-size:10px;font-family:ui-monospace,monospace;font-weight:700;color:rgba(44,18,16,.7)">` +
    `<b style="color:#D90429">${METRO.length}</b> metro stations &nbsp;·&nbsp; ` +
    `<b style="color:#1C1917">${RAIL.length}</b> railway terminals</span>` +
    `</div></div>`
  );
}

export default function MetroInjector() {
  // Re-scan on navigation; the layout outlives the page children.
  const pathname = usePathname();

  useEffect(() => {
    const host = document.querySelector<HTMLElement>("[data-metro-map]");
    if (!host) return;

    let disposed = false;
    let built: import("leaflet").Map | null = null;

    (async () => {
      const L = await import("leaflet");
      if (disposed || !host.isConnected) return;

      // Leaflet throws if the node was already initialised, which happens on
      // client-side navigation back into a guide page.
      const el = host as HTMLElement & { _leaflet_id?: number };
      if (el._leaflet_id != null) return;

      host.innerHTML = "";
      const map = L.map(el, { scrollWheelZoom: false });
      built = map;

      // The original hides every Leaflet control, zoom buttons included, so
      // the map looks the same here without them. That would leave a desktop
      // visitor no way to zoom at all, though, so the wheel is wired up by
      // interaction instead of by a control: clicking the map - which is what
      // opening a station popup involves anyway - arms it, and leaving the map
      // disarms it so the page still scrolls normally. Double-click and pinch
      // work throughout, as they do on the original.
      const container = map.getContainer();
      container.addEventListener("click", () => map.scrollWheelZoom.enable());
      container.addEventListener("mouseleave", () => map.scrollWheelZoom.disable());

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Lines below, pins above.
      const routes = L.featureGroup();
      for (const l of LINES) {
        L.polyline(l.geometry, {
          color: l.color,
          weight: l.weight,
          opacity: 0.85,
          lineJoin: "round",
        }).addTo(routes);
      }
      routes.addTo(map);

      const pin = (color: string, rail: boolean) =>
        L.divIcon({
          className: "",
          html:
            `<span style="display:block;width:${rail ? 12 : 10}px;height:${rail ? 12 : 10}px;` +
            `border-radius:${rail ? "3px" : "50%"};background:${color};border:2px solid #fff;` +
            `box-shadow:0 1px 4px rgba(0,0,0,.45)"></span>`,
          iconSize: [rail ? 12 : 10, rail ? 12 : 10],
          iconAnchor: [rail ? 6 : 5, rail ? 6 : 5],
          popupAnchor: [0, -6],
        });

      const popup = (s: Station) => {
        const on = s.lines.length
          ? `<br><span style="color:#D90429;font-weight:700">${s.lines
              .map(escapeHtml)
              .join(" · ")}</span>`
          : "";
        const bn = s.bn
          ? ` <span style="color:#6B7280;font-weight:400">(${escapeHtml(s.bn)})</span>`
          : "";
        // Railway labels continue past the name into a code, a street address
        // and a note; keep that as the subtitle, minus the code. Metro labels
        // carry nothing past the name and its Bengali, which are already shown.
        const rest =
          s.kind === "rail"
            ? (s.detail.split(/\xF0\x9F\x9A\x86/)[0] || s.detail)
                .slice(s.name.length)
                .replace(/^\s*[A-Z]{2,4}(?:-[A-Z])?\b/, "")
                .replace(/\s+/g, " ")
                .trim()
            : "";
        const extra = rest
          ? `<br><span style="color:#6B7280">${escapeHtml(rest.slice(0, 150))}</span>`
          : "";
        return `<b>${escapeHtml(s.name)}</b>${bn}${on}${extra}`;
      };

      const stops = L.featureGroup();
      for (const s of METRO) {
        const owner = LINES.find((l) => l.name === s.lines[0]);
        L.marker(s.latlng, { icon: pin(owner?.color ?? "#D90429", false), keyboard: false })
          .bindPopup(popup(s))
          .addTo(stops);
      }
      // Suburban railway terminals, kept visually distinct as the original does.
      for (const s of RAIL) {
        L.marker(s.latlng, { icon: pin("#1C1917", true), keyboard: false })
          .bindPopup(popup(s))
          .addTo(stops);
      }
      stops.addTo(map);

      try {
        map.fitBounds(routes.getBounds().pad(0.1));
      } catch {
        map.setView([22.56, 88.37], 12);
      }

      const legend = document.createElement("div");
      legend.innerHTML = legendHtml();
      el.appendChild(legend.firstElementChild!);
    })();

    return () => {
      disposed = true;
      if (built) {
        built.remove();
        built = null;
      }
    };
  }, [pathname]);

  return null;
}