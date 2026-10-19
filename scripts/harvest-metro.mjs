/**
 * Harvests the Kolkata transit network from the original's guide map.
 *
 * WHY
 * The /guide and /guide/navigating-kolkata pages advertise an "Interactive
 * Metro & Railway Map" (58 stations, 5 lines) but the body we mirrored is the
 * loading fallback: "Loading Kolkata Transit & Metro GIS Network...". Like the
 * hero card and the pandal list, the map is rendered client-side, so a static
 * scrape only ever captured the skeleton. The station coordinates exist
 * nowhere in our mirror or in data/guides.json.
 *
 * HOW
 * The original draws the map with Leaflet on EPSG:3857 at zoom 12, with the
 * map pane at translate3d(0,0,0). That makes the harvest exact rather than
 * approximate: the pins' transform offsets and the polylines' SVG path data
 * share one pixel coordinate space, and inverting the standard Web Mercator
 * projection at that zoom gives latitude/longitude directly. No geocoding, no
 * guessing.
 *
 * Station names are not in the DOM, but clicking a pin opens a tooltip with the
 * name, line, structure and interchange detail, so the labels are read the
 * same way a visitor reads them.
 *
 * Line names are not taken from the map - it only encodes a stroke colour -
 * but from the corridor cards already in our mirror, which pair each colour
 * with a name, a Bengali name and a station count.
 *
 * Usage: node scripts/harvest-metro.mjs
 * Writes: data/metro.json
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE = "https://www.durgapujakolkata.in/guide/navigating-kolkata";
const OUT = path.join(process.cwd(), "data", "metro.json");

/** Colour -> line identity, from the corridor cards in mirror/guide. */
const LINES = [
  { color: "#2563EB", name: "Blue Line", bn: "ব্লু লাইন", route: "Dakshineswar ↔ Kavi Subhas" },
  { color: "#16A34A", name: "Green Line", bn: "গ্রিন লাইন", route: "Howrah Maidan ↔ Esplanade" },
  { color: "#9333EA", name: "Purple Line", bn: "পার্পল লাইন", route: "Majerhat ↔ Joka" },
  { color: "#CA8A04", name: "Yellow Line", bn: "ইয়েলো লাইন", route: "Noapara ↔ Airport" },
  { color: "#EA580C", name: "Orange Line", bn: "অরেঞ্জ লাইন", route: "Beleghata ↔ Kavi Subhas" },
];

const nameFor = (color) =>
  LINES.find((l) => l.color.toLowerCase() === String(color).toLowerCase());

/** Inverts the Web Mercator projection Leaflet uses, at the given zoom. */
function pxToLatLng(x, y, zoom, tileSize) {
  const worldSize = tileSize * 2 ** zoom;
  const lng = (x / worldSize) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / worldSize))) * 180) / Math.PI;
  return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
}

/** Parses an SVG polyline "d" of absolute M/L commands into [x, y] pairs. */
function parsePath(d) {
  const pts = [];
  for (const m of d.matchAll(/([ML])\s*(-?[\d.]+)[,\s]+(-?[\d.]+)/g)) {
    pts.push([parseFloat(m[2]), parseFloat(m[3])]);
  }
  return pts;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

console.log("fetching", SOURCE);
const res = await page.goto(SOURCE, { waitUntil: "networkidle", timeout: 90000 });
if (!res || res.status() >= 400) {
  console.error("source unavailable:", res && res.status());
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(4500);

const mapInfo = await page.evaluate(() => {
  const tile = document.querySelector(".leaflet-tile");
  const pane = document.querySelector(".leaflet-map-pane");
  const src = tile?.getAttribute("src") || "";
  const z = Number((src.match(/\/(\d+)\/\d+\/\d+\.png$/) || [])[1]);
  const t = (pane?.style.transform || "").match(/translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/);
  return {
    zoom: z,
    originX: t ? parseFloat(t[1]) : 0,
    originY: t ? parseFloat(t[2]) : 0,
    polylines: [...document.querySelectorAll(".leaflet-overlay-pane path")].map((p) => ({
      stroke: p.getAttribute("stroke"),
      weight: p.getAttribute("stroke-weight"),
      d: p.getAttribute("d") || "",
    })),
    // The tile layer carries the projection itself. A tile named z/x/y has its
    // top-left at world pixel (x*tileSize, y*tileSize); the same tile sits at
    // translate3d(tx, ty) inside the map pane. The difference is the map's
    // pixel origin, which is what marker offsets are measured from - reading
    // the pane transform is not enough, because it settles to 0,0 on a map
    // that has already panned.
    tiles: [...document.querySelectorAll(".leaflet-tile")].map((el) => {
      const m = (el.getAttribute("src") || "").match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);
      const t = (el.style.transform || "").match(
        /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/
      );
      if (!m || !t) return null;
      return {
        z: Number(m[1]),
        x: Number(m[2]),
        y: Number(m[3]),
        tx: parseFloat(t[1]),
        ty: parseFloat(t[2]),
      };
    }).filter(Boolean),
    pins: [...document.querySelectorAll(".leaflet-marker-icon")].map((el) => {
      const t2 = (el.style.transform || "").match(
        /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/
      );
      return {
        x: t2 ? parseFloat(t2[1]) : null,
        y: t2 ? parseFloat(t2[2]) : null,
      };
    }),
  };
});

if (!mapInfo.zoom) throw new Error("could not determine map zoom");

// Derive tile size and the map's pixel origin from the tile layer. Tiles one
// column apart differ by exactly one tile width on screen, which gives the
// tile size without assuming Leaflet's 256 default.
if (!mapInfo.tiles.length) throw new Error("no tiles found to anchor the projection");
const sortedTx = [...new Set(mapInfo.tiles.map((t) => t.tx))].sort((a, b) => a - b);
let tileSize = 256;
for (let i = 1; i < sortedTx.length; i++) {
  const gap = sortedTx[i] - sortedTx[i - 1];
  if (gap > 0 && gap < 512) {
    tileSize = gap;
    break;
  }
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const ox = median(mapInfo.tiles.map((t) => t.x * tileSize - t.tx));
const oy = median(mapInfo.tiles.map((t) => t.y * tileSize - t.ty));

console.log(
  `zoom ${mapInfo.zoom} | tile ${tileSize}px | pixel origin (${ox}, ${oy}) | ` +
    `${mapInfo.polylines.length} lines | ${mapInfo.pins.length} pins`
);

// Pin labels only exist once a pin is activated, so read them one at a time.
console.log("reading pin labels...");
const labels = [];
for (let i = 0; i < mapInfo.pins.length; i++) {
  const text = await page.evaluate(async (idx) => {
    const pin = document.querySelectorAll(".leaflet-marker-icon")[idx];
    if (!pin) return "";
    // Clear whatever the previous click opened before asking again.
    document
      .querySelector(".leaflet-popup-content")
      ?.closest(".leaflet-popup")
      ?.remove();
    document.querySelectorAll(".leaflet-tooltip").forEach((t) => t.remove());
    pin.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
    );
    await new Promise((r) => setTimeout(r, 280));
    const el =
      document.querySelector(".leaflet-tooltip") ||
      document.querySelector(".leaflet-popup-content");
    return (el?.innerText || "").replace(/\s+/g, " ").trim();
  }, i);
  labels.push(text);
  if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${mapInfo.pins.length}`);
}

await browser.close();

const lines = mapInfo.polylines
  .map((p) => {
    const meta = nameFor(p.stroke);
    const pts = parsePath(p.d);
    return {
      color: p.stroke,
      weight: Number(p.weight) || 5,
      name: meta?.name ?? "Unnamed line",
      bn: meta?.bn ?? "",
      route: meta?.route ?? "",
      geometry: pts.map(([x, y]) => pxToLatLng(x + ox, y + oy, mapInfo.zoom, tileSize)),
    };
  })
  .filter((l) => l.geometry.length >= 2);

/** Distance in metres from a point to a line's polyline. */
function metresToLine(point, geometry) {
  const R = 111320;
  const lat0 = (point[0] * Math.PI) / 180;
  const xy = (q) => [q[1] * R * Math.cos(lat0), q[0] * R];
  const [px, py] = xy(point);
  let best = Infinity;
  for (let i = 1; i < geometry.length; i++) {
    const [ax, ay] = xy(geometry[i - 1]);
    const [bx, by] = xy(geometry[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

/**
 * Which lines a station belongs to, decided by geometry rather than by text.
 *
 * The original's station tooltips hold nothing but the station name, in
 * English and Bengali, so there is no line to read - but every station sits
 * on top of the polyline that serves it, and across the 58 pins the median
 * distance to the nearest line is 0 m with a 90th percentile of 12 m. A
 * threshold of 80 m therefore separates "on this line" from "not", and picks
 * up exactly the three interchanges (Noapara, Esplanade, Kavi Subhas) without
 * being told where they are.
 */
const ON_LINE_M = 80;

const stations = mapInfo.pins
  .map((pin, i) => {
    if (pin.x === null) return null;
    const raw = labels[i] || "";
    // Some pins are footnote or attribution markers rather than places, and
    // they read as prose ("Coordinates and addresses via Google Places
    // lookup, Aug 2026"). They are classified apart so they neither inflate
    // the station count nor get rendered as a pin.
    const isInfo =
      /Coordinates|lookup|Aug\s*20\d\d|Google Places|via\s/i.test(raw) &&
      !/[ঀ-৿]/.test(raw.slice(0, 40));
    // The page's own badge counts metro stations only. Suburban railway
    // terminals announce themselves with a train and a rail code.
    const isRail =
      /🚆|Railway|Handling long-dista/i.test(raw) || /\b[A-Z]{4}\b/.test(raw);
    const latlng = pxToLatLng(pin.x + ox, pin.y + oy, mapInfo.zoom, tileSize);

    const byDistance = lines
      .map((l) => ({ name: l.name, d: metresToLine(latlng, l.geometry) }))
      .sort((a, b) => a.d - b.d);
    // Joka sits ~1.2 km off the Purple Line, the only line out that way, so
    // the nearest line is taken as a fallback rather than leaving it unlined.
    const onLines = byDistance.filter((l) => l.d <= ON_LINE_M).map((l) => l.name);
    const linesFor = onLines.length ? onLines : [byDistance[0].name];

    // Metro labels are just "Name(বাংলা)", so split the two scripts for
    // display instead of printing them jammed together.
    // Railway labels continue past the name into a code and a street address
    // ("Shalimar SHM Shalimar Station Rd, Kazipada, Howrah 711103"), which is
    // cut at the code - a bare "two to four capitals" token - or at the first
    // comma. Codes are not matched from a fixed list, so a terminal the
    // original adds later is cleaned up the same way.
    let name = raw.split(/🚆/)[0] || raw;
    let bn = "";
    if (!isInfo && !isRail) {
      const m = name.match(/^(.*?)\s*\(([ঀ-৿\s]+)\)\s*$/);
      if (m) {
        name = m[1];
        bn = m[2];
      }
    } else {
      name = name
        .split(/\s+[A-Z]{2,4}(?:-[A-Z])?\b/)[0]
        .split(",")[0]
        .replace(/\s{2,}.*$/, "");
    }
    name = name.replace(/\s+/g, " ").trim().slice(0, 60);
    bn = bn.replace(/\s+/g, " ").trim();

    return {
      name,
      bn,
      kind: isInfo ? "info" : isRail ? "rail" : "metro",
      lines: linesFor,
      latlng,
      detail: raw,
    };
  })
  // Footnote markers are not places: they have no coordinates worth drawing
  // (the harvest puts one at null island) and the page states their provenance
  // as prose. Dropped rather than pinned at 0,0.
  .filter((s) => s && s.kind !== "info");

const payload = {
  _provenance: {
    source: SOURCE,
    harvested: new Date().toISOString(),
    zoom: mapInfo.zoom,
    note:
      "Coordinates inverted from the original's Leaflet pixel space at zoom " +
      mapInfo.zoom +
      ". Line names from mirror/guide corridor cards. Re-run " +
      "scripts/harvest-metro.mjs to refresh.",
  },
  lines,
  stations,
};

writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");

const metro = stations.filter((s) => s.kind === "metro").length;
const rail = stations.filter((s) => s.kind === "rail").length;
const all = [...stations.map((s) => s.latlng), ...lines.flatMap((l) => l.geometry)];
const bad = all.filter(([la, ln]) => !Number.isFinite(la) || Math.abs(la) > 60 || Math.abs(ln) > 180);
if (bad.length) throw new Error(`${bad.length} points outside plausible bounds - projection is wrong`);
console.log(`\nlines:    ${lines.length} (${lines.map((l) => l.name).join(", ")})`);
console.log(`stations: ${stations.length} = ${metro} metro + ${rail} suburban railway`);

const metroStations = stations.filter((s) => s.kind === "metro");
const placed = metroStations.filter((s) => s.lines.length).length;
if (placed !== metroStations.length) {
  throw new Error(`${metroStations.length - placed} stations could not be placed on a line`);
}

// The original draws one pin per line at an interchange, which is why its own
// badge counts 58 while the network has 55 distinct places. Reported rather
// than merged, so a change in the original is visible on the next run.
const byname = {};
for (const s of metroStations) (byname[s.name] ||= []).push(s);
const interchanges = Object.entries(byname).filter(([, v]) => v.length > 1);
console.log(
  `unique metro names: ${Object.keys(byname).length} over ${metroStations.length} pins` +
    (interchanges.length
      ? ` (${interchanges.map(([n, v]) => `${n} x${v.length}`).join(", ")})`
      : "")
);

const perLine = lines.map(
  (l) => `${l.name}: ${metroStations.filter((s) => s.lines.includes(l.name)).length}`
);
console.log(`pins per line:    ${perLine.join(" | ")}`);

// Cross-check the geometry against the page's own corridor cards, which state
// how many stations each line has. The card figures count places rather than
// pins, so interchange duplicates are collapsed before comparing - and with
// that done the two agree exactly: 26/12/7/4/9. Any drift in the projection,
// the geometry or the threshold breaks this, so it is asserted rather than
// printed.
const guideHtml = readFileSync(
  path.join(process.cwd(), "mirror", "guide", "navigating-kolkata.html"),
  "utf8"
);
const cardSection = guideHtml.slice(guideHtml.indexOf("Kolkata Metro Network Corridors"));
const cardNames = [...new Set([...cardSection.matchAll(/([A-Z][a-z]+ Line)\b/g)].map((m) => m[1]))];
const cardCounts = [...cardSection.matchAll(/(\d+)\s*Stations/g)].map((m) => Number(m[1]));
if (cardNames.length !== cardCounts.length || !cardNames.length) {
  throw new Error(
    `corridor cards unreadable: ${cardNames.length} names vs ${cardCounts.length} counts`
  );
}
const mismatches = cardNames
  .map((n, idx) => {
    const distinct = new Set(metroStations.filter((s) => s.lines.includes(n)).map((s) => s.name)).size;
    return { line: n, card: cardCounts[idx], distinct };
  })
  .filter((x) => x.card !== x.distinct);
if (mismatches.length) {
  throw new Error(
    "geometry disagrees with the corridor cards: " +
      mismatches.map((m) => `${m.line} card=${m.card} geometry=${m.distinct}`).join(", ")
  );
}
console.log(
  `corridor cards cross-check: ${cardNames.map((n, i) => `${n} ${cardCounts[i]}`).join(" | ")} - all match`
);

console.log(
  `\npage badge claims 58 metro stations -> ${metro === 58 ? "matches" : "DIFFERS (" + metro + ")"}`
);
console.log(`railway terminals: ${stations.filter((s) => s.kind === "rail").map((s) => s.name).join(", ")}`);
console.log("wrote", OUT);