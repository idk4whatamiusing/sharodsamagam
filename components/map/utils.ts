import type {
  CuratedRoute,
  Pandal,
  PlannerStop,
  RouteGeo,
  RouteStop,
  TravelMode,
} from "./types";

export const SITE_NAME = "Sharodsamagam";

export const ZONES = [
  { id: "all", label: "All Kolkata" },
  { id: "north", label: "North Kolkata" },
  { id: "south", label: "South Kolkata" },
  { id: "central", label: "Central Kolkata" },
  { id: "east", label: "East Kolkata" },
  { id: "howrah", label: "Howrah" },
  { id: "others", label: "Others" },
] as const;

export const ZONE_LABEL: Record<string, string> = {
  all: "All Kolkata",
  north: "North Kolkata",
  south: "South Kolkata",
  central: "Central Kolkata",
  east: "East Kolkata",
  howrah: "Howrah",
  others: "Others",
};

export const CATEGORY_OPTIONS = [
  { id: "all", label: "All Categories" },
  { id: "featured", label: "Featured / Popular" },
  { id: "award-winner", label: "Award Winner" },
  { id: "famous-for-lighting", label: "Famous for Lighting" },
  { id: "traditional", label: "Traditional" },
  { id: "theme-based", label: "Theme-Based" },
  { id: "historical", label: "Historical" },
  { id: "community-favorite", label: "Community Favorite" },
  { id: "unesco-listed", label: "UNESCO Listed" },
] as const;

export const TRANSIT_OPTIONS = [
  { id: "all", label: "All Transit Hubs (Metro, Rail, Ferry)" },
  { id: "metro-station", label: "Metro Stations" },
  { id: "railway-station", label: "Railway Stations" },
  { id: "ferry-ghat", label: "Ferry Ghats & Jetties" },
] as const;

export const MODE_META: Record<
  TravelMode,
  { label: string; valhalla: string; google: string; speedKmh: number }
> = {
  walk: { label: "Walk", valhalla: "pedestrian", google: "walking", speedKmh: 3.86 },
  drive: { label: "Drive", valhalla: "auto", google: "driving", speedKmh: 13.68 },
  cycle: { label: "Cycle", valhalla: "bicycle", google: "bicycling", speedKmh: 11.11 },
  transit: { label: "Transit", valhalla: "pedestrian", google: "transit", speedKmh: 11.85 },
};

export const MODE_ORDER: TravelMode[] = ["walk", "drive", "cycle", "transit"];

const SMALL_WORDS = new Set(["of", "and", "the", "to", "at", "in", "on", "for", "by"]);

/** "48 NORTH BASUDEBPUR NATUN PALLY" -> "48 North Basudebpur Natun Pally" */
export function titleCase(value: string): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(/([\s/\-–—&()]+)/)
    .map((part, index) => {
      if (!part || /^[\s/\-–—&()]+$/.test(part)) return part;
      if (/^\d+$/.test(part)) return part;
      if (part.length <= 3 && !SMALL_WORDS.has(part)) return part.toUpperCase();
      if (index > 0 && SMALL_WORDS.has(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

export function zoneLabel(zone: string): string {
  return ZONE_LABEL[zone] || titleCase(zone || "");
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "--";
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (!hours) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function formatKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return "--";
  if (Math.abs(km - Math.round(km)) < 0.05) return `${Math.round(km)} km`;
  return `${km.toFixed(1)} km`;
}

export function formatDistanceM(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return "";
  if (m < 1000) return `${Math.round(m)} m`;
  return formatKm(m / 1000);
}

export function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function straightLineStopMeters(stops: PlannerStop[]): number {
  let total = 0;
  for (let i = 1; i < stops.length; i += 1) total += haversineM(stops[i - 1], stops[i]);
  return total;
}

const ROAD_FACTOR = 1.18;

export function estimateModeSeconds(distanceM: number, mode: TravelMode): number {
  const speed = MODE_META[mode].speedKmh;
  return Math.round(((distanceM * ROAD_FACTOR) / 1000 / speed) * 3600);
}

export function routeModeSeconds(distanceM: number): Record<TravelMode, number> {
  const km = Math.max(0, distanceM) / 1000;
  return {
    walk: Math.max(60, Math.round((km / 3.8) * 3600)),
    drive: Math.max(60, Math.round((km / 15.7) * 3600)),
    cycle: Math.max(60, Math.round((km / 12.8) * 3600)),
    transit: Math.max(300, Math.round((km / 16) * 3600 + 120)),
  };
}

export function estimateAllModes(
  distanceM: number,
  fallbackSeconds?: Partial<Record<TravelMode, number | null>>
): Record<TravelMode, number> {
  return {
    walk: fallbackSeconds?.walk || estimateModeSeconds(distanceM, "walk"),
    drive: fallbackSeconds?.drive || estimateModeSeconds(distanceM, "drive"),
    cycle: fallbackSeconds?.cycle || estimateModeSeconds(distanceM, "cycle"),
    transit: fallbackSeconds?.transit || estimateModeSeconds(distanceM, "transit"),
  };
}

export function defaultModeSecondsForGeo(geo: RouteGeo): Record<TravelMode, number> {
  const km = geo.km || (geo.distanceM ? geo.distanceM / 1000 : 0);
  return {
    walk: geo.modeSeconds.walk || estimateModeSeconds(km * 1000, "walk"),
    drive: geo.modeSeconds.drive || estimateModeSeconds(km * 1000, "drive"),
    cycle: geo.modeSeconds.cycle || estimateModeSeconds(km * 1000, "cycle"),
    transit: geo.modeSeconds.transit || estimateModeSeconds(km * 1000, "transit"),
  };
}

export function summaryModeToTravelMode(mode: string | null | undefined): TravelMode {
  const low = (mode || "walk").toLowerCase();
  if (low === "drive") return "drive";
  if (low === "cycle") return "cycle";
  if (low === "transit") return "transit";
  return "walk";
}

/** The numbered pandal stops on a curated trail.
 *
 * The API's `waypoints` also contains transfer points (metro/railway/ferry)
 * that are stored with `poi-*` ids. The published trail count - DPKR01 has 19,
 * DPKR06 has 16 - counts only pandals, so those transit transfers are removed
 * here. Start and finish are shown separately by the trail cards.
 */
export function pandalStops(route: CuratedRoute): RouteStop[] {
  return route.waypoints.filter((stop) => !String(stop.id || "").startsWith("poi-"));
}

export function stopFromPandal(p: Pandal): PlannerStop {
  return {
    id: p.slug,
    name: p.name,
    locality: p.locality || p.address,
    zone: p.zone,
    lat: p.lat,
    lng: p.lng,
    metro: p.metro,
    kind: "pandal",
  };
}

export function stopFromRouteStop(s: {
  id?: string | number | null;
  name: string;
  locality: string;
  zone: string;
  lat: number;
  lng: number;
  nearestMetro?: string;
}): PlannerStop {
  return {
    id: String(s.id ?? s.name),
    name: s.name,
    locality: s.locality || "",
    zone: s.zone,
    lat: s.lat,
    lng: s.lng,
    metro: s.nearestMetro || "",
    kind: "pandal",
  };
}

export function curatedStops(route: CuratedRoute): PlannerStop[] {
  const out: PlannerStop[] = [];
  if (route.start) out.push(stopFromRouteStop(route.start));
  for (const w of route.waypoints) out.push(stopFromRouteStop(w));
  if (route.end) out.push(stopFromRouteStop(route.end));
  return out;
}

/** Apple Maps cannot carry waypoints, so it gets the first hop plus the
 *  overall origin/destination pair. The per-stop list in the plan covers the
 *  rest of the route. */
export function appleMapsUrl(stops: PlannerStop[], mode: TravelMode): string {
  if (stops.length < 2) return "";
  const params = new URLSearchParams({
    saddr: `${stops[0].lat},${stops[0].lng}`,
    daddr: `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`,
  });
  // dirflg: w = walking, d = driving, r = transit.
  params.set("dirflg", mode === "walk" ? "w" : mode === "transit" ? "r" : "d");
  return `https://maps.apple.com/?${params.toString()}`;
}

export function googleMapsUrl(stops: PlannerStop[], mode: TravelMode): string {
  if (stops.length < 2) return "";
  const origin = `${stops[0].lat},${stops[0].lng}`;
  const destination = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;
  const waypoints = stops
    .slice(1, -1)
    .map((s) => `${s.lat},${s.lng}`)
    .join("|");
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: MODE_META[mode].google,
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Decode a Valhalla / Google encoded polyline (precision 6). */
export function decodePolyline(encoded: string, precision = 6): [number, number][] {
  const factor = 10 ** precision;
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}

/** Pandals close to a plotted line: <100 m, or <250 m when featured. */
export function pandalsAlongRoute(
  pandals: Pandal[],
  coords: [number, number][],
  limit = 10
): { pandal: Pandal; distanceM: number; alongIndex: number }[] {
  if (!coords.length) return [];
  const hits: { pandal: Pandal; distanceM: number; alongIndex: number }[] = [];
  for (const pandal of pandals) {
    let best = { distanceM: Infinity, alongIndex: 0 };
    for (let i = 0; i < coords.length; i += 1) {
      const d = haversineM(pandal, { lat: coords[i][0], lng: coords[i][1] });
      if (d < best.distanceM) best = { distanceM: d, alongIndex: i };
      if (d < 25) break;
    }
    const threshold = pandal.featured ? 250 : 100;
    if (best.distanceM <= threshold) hits.push({ pandal, ...best });
  }
  return hits
    .sort((a, b) => a.alongIndex - b.alongIndex || a.distanceM - b.distanceM)
    .slice(0, limit);
}

export function totalCoordsLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    total += haversineM(
      { lat: coords[i - 1][0], lng: coords[i - 1][1] },
      { lat: coords[i][0], lng: coords[i][1] }
    );
  }
  return total;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export const STORAGE = {
  saved: "ss-map-saved",
  likedRoutes: "ss-routes-liked",
  savedRoutes: "ss-routes-saved",
  installDismissed: "ss-map-install-dismissed",
  suggestions: "ss-map-suggestions",
};

const POI_ICON_FILES: Record<string, string> = {
  "metro-station": "public-transport",
  restaurant: "restaurants",
  parking: "special-parkings",
  pharmacy: "medicine-stores",
  atm: "banks-atms",
  "popular-landmark": "popular-landmarks",
};

export function poiIconPath(category: string): string {
  return `/poi-icons/${POI_ICON_FILES[category] || category}.png`;
}
