/**
 * Geocode the pandals in public/points.json that have no coordinates.
 *
 * Design notes:
 *  - The scraped data genuinely lacks coordinates for these entries; the
 *    original site never had them either (verified against the pre-cleanup
 *    RSC payloads in data/raw/). So this recovers locality-level positions,
 *    not exact ones.
 *  - Addresses are decomposed before geocoding. Throwing
 *    "43/B, Bagmari, Kolkata 700054" at a geocoder misses, while "Bagmari
 *    Kolkata" resolves. House numbers and pincodes actively hurt matching.
 *  - Pandal NAMES are never fuzzy-matched. Geocoders confidently return a
 *    different pandal for these - "Basak Bagan Sarbojanin Durgotsab" resolves
 *    to "Gariahat Sarbojanin Durgotsab", several km away. Only localities
 *    that we independently recognise are used.
 *  - Every result is bbox-checked against the Kolkata metropolitan area, so
 *    genuine out-of-area entries (Kalyani, Bangaon) fall through instead of
 *    being placed somewhere wrong.
 *  - Results are cached in data/geocoded-localities.json so re-runs make no
 *    network calls at all.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const POINTS = path.join(ROOT, "public/points.json");
const CACHE = path.join(ROOT, "data/geocoded-localities.json");
const REPORT = path.join(ROOT, "data/geocode-report.json");

// Generous box around the Kolkata metropolitan area.
const BBOX = { south: 22.30, north: 23.05, west: 87.95, east: 88.75 };

const UA = "Sharodsamagam geocoder/1.0 (static site build)";

// Realities of the corpus, not generic knowledge.
const OUT_OF_AREA = ["KALYANI", "NADIA", "BANGAON", "DHARMAPUKURIA", "KHAMARKALLA", "HABRA"];

// Localities we are willing to place a pandal on. Anything not in here is
// never fuzzy-matched from free text. Extended from the actual corpus - most
// of these appear verbatim in pandal names that carry no address.
const GAZETTEER = [
  "BEADON STREET", "BEADON SQUARE", "BELVEDERE", "BOWBAZAR", "BOW BAZAR",
  "BRAHMPUR", "BRIHATTARA", "BAGMARI", "BOSEPUKUR", "BOSEPUKUR", "TAL BAGAN",
  "TALBAGAN", "BASAKBAGAN", "BASAK BAGAN", "BAGHAJATIN", "BAGHA JATIN",
  "BAGUIATI", "BARISHA", "BARANAGAR", "BELIAGHATA", "BELEGHATA", "BEHALA",
  "BHARATMATA", "BHOWANIPORE", "BHOWANIPUR", "BHUKAILASH", "BIDHANNAGAR",
  "BONGAON", "CHAMPADANI", "CHAMRAPATTI", "CHETTALA", "CHURACHAL",
  "DUM DUM", "DUMDUM", "ENTALLY", "GARIA", "GARIAHAT", "GARIA HAT",
  "GOBARDANGA", "GOPALNAGAR", "GOLF GREEN", "HALDIRAM", "HARIDEVPUR",
  "JADAVPUR", "JADUNANAK", "JHOWRAH", "KALIBER", "KALIGHAT", "KAMARHATTI",
  "KAMDAHARI", "KANKUR", "KASBA", "KESHTABURI", "KIDDERPORE", "KOLKATA",
  "LAKE TOWN", "LAKHAN BAZAR", "MADAN MOHAN", "MAHALAYAM", "METIABRUZZ",
  "MOIRA", "MOHUN BAGAN", "MOHUNBAGAN", "MUKUNDA", "NAGERBAZAR", "NEW ALIPORE",
  "NEW TOWN", "NEWTOWN", "PATEL", "PATURI", "PHOOLBAGAN", "PURBA",
  "RABINDRA SAROBAR", "RAJABAZAR", "RAJPUR", "RAMKRISHAPUR", "SANTRAGACHI",
  "SANTOSH", "SARABA", "SARANGABAN", "SHIBPUR", "SHYAMBAZAR", "SHYAMBAZAR METRO",
  "SITALATALA", "SONARAMPUR", "SOVABAZAR", "TALTALA", "THAKURPUKUR",
  "TOLLYGUNGE", "TOLLY GUNGE", "UDAYPUR", "ULTARPARA", "ULUBERIA", "VIVEKANANDA",
  // --- added from the pandals that had fallen through to metro centroids ---
  "CHANDRANATH CHATTERJEE STREET", "MONMOHAN BOSE STREET", "GRAY STREET",
  "GRAY ROAD", "TAMER LANE", "MADHUSUDAN DAS LANE", "RAJA KALI KRISHNA LANE",
  "MANICKTALA", "MANIK TALA", "KABIRAJBAGAN", "KABIRA BAGAN", "JUDGEBAGAN",
  "KATJUNAGAR", "KHIDDERPORE", "KIDDER PORE", "KRISHNABAGAN", "LAKEVIEW",
  "LAKE GARDENS", "LAKEVIEW PARK", "KALIKAPUR", "KALIKAPUR", "MAJUMDER PARA",
  "MALL PALLY", "MECHUA BAZAR", "NABAPALLY", "NAWPARA", "NAW PARA",
  "PALPARA", "PATALDANGA", "PUTIARY", "PUTIARY", "RAMGARH", "SAHIDNAGAR",
  "SALKIA", "SATATTAR PALLI", "SHIBRAMPUR", "ASWATHALA", "SOBHABAZAR",
  "SOORA BAZAR", "SHYAMBAZAR METRO", "TALTATA", "TEKIAPARA", "TENTULBERIA",
  "SHIBTALAPARK", "UDDIPANI", "PARK CIRCUS", "UTTAR BANTRA", "MAJUMDER",
  "BENIATOLA", "CHURACHAL", "RAJABAZAR", "BAGHAJATIN COLONY", "SARADA PALLY",
  "JADU COLONY", "NABAPATRIKA", "SANTRI", "ULTADANGA", "MAHATIRTHAM",
  "MOIRA", "DHAKURIA", "HABRA", "BALLYGUWAH", "RAHARHAT", "RAIPUR",
  "RAGHUNATHPUR", "SRIRAMPUR", "ABHISHIKTA", "BENOYAR", "NETAJI",
];

const METROS = {
  "Shyambazar / Shobhabazar Metro": "Shyambazar, Kolkata",
  "Salt Lake Sector V / Phoolbagan Metro": "Phoolbagan, Kolkata",
  "Kalighat / Jatin Das Park Metro": "Kalighat, Kolkata",
  "Kavi Subhash / Rabindra Sarobar Metro": "Rabindra Sarobar, Kolkata",
  "Tollygunge / Behala Chowrasta Metro": "Tollygunge, Kolkata",
  "Howrah Maidan Metro": "Howrah Maidan, Howrah",
  "Kolkata Metro": "Central Kolkata",
};

// A geocoded locality that lands implausibly far from the metro station the
// site itself records for that pandal is almost certainly a fuzzy match, not
// a location. "Chandranath Chatterjee Street, Kolkata" resolves to an
// astrologer 10km away; "Netaji Sarak..." resolves to Sukanta Pally, 33km away.
// nearestMetro is independent metadata, so it makes a good sanity check.
const MAX_DRIFT_KM = 9;
const kmBetween = (a, b) => {
  const R = 6371, t = Math.PI / 180;
  const dLa = (b.lat - a.lat) * t, dLo = (b.lng - a.lng) * t;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const cache = fs.existsSync(CACHE)
  ? JSON.parse(fs.readFileSync(CACHE, "utf8"))
  : {};
let apiCalls = 0;
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const squish = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// Words that only ever appear in an organisation's own name, never in a
// place name. If a geocoder match contains one of these we have been fuzzy
// matched onto a DIFFERENT pandal/club and must reject it.
const ORG_WORDS =
  /SANGHA|SAMITY|SAMITI|SAMITIYA|COMMITTEE|COMMITTE|COMMITTTEE|DURGOTSAV|DURGAPUJA|DURGOPUJA|SARBOJAN|SARBAJAN|WELFARE|ASSOCIATION|ORGANIS|ORGANIZ|CLUB|SOCIAL|PALLIBASI|BRINDA|NGO|SEVAK|MILAN/;

/** Photon (OSM-backed). Returns {lat,lng,name} or null. Cached forever. */
async function geocode(query) {
  const key = norm(query);
  if (key in cache) return cache[key];
  if (!key) return null;

  apiCalls += 1;
  const url = `https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(query)}`;
  let out = null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const f = (await res.json())?.features?.[0];
      if (f) {
        const lng = Number(f.geometry.coordinates[0]);
        const lat = Number(f.geometry.coordinates[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) out = { lat, lng, name: f.properties?.name || "" };
      }
    }
  } catch {
    /* leave out null */
  }
  // Only cache successes. A transient timeout must not become a permanent
  // "this place does not exist".
  if (out) cache[key] = out;
  await sleep(1100); // be a courteous client
  return out;
}

/** Accept a hit only if it is a place, inside the metro area. */
function usable(hit) {
  if (!hit) return false;
  if (ORG_WORDS.test(hit.name || "")) return false; // matched another org
  return inBbox(hit);
}
const inBbox = (p) =>
  p && p.lat >= BBOX.south && p.lat <= BBOX.north && p.lng >= BBOX.west && p.lng <= BBOX.east;

const stripHouse = (seg) => !/^\s*[\w/-]*\s*\d+\s*[\w/-]*\s*$/.test(seg) || /[a-z]/i.test(seg);

/**
 * Most of the corpus stores the pandal's own name as its "address", followed
 * by "(FFD Member 2025)". Those carry no location at all, and feeding them
 * to a geocoder is actively harmful - "BASAKBAGAN SARBOJANIN DURGOTSAB,
 * Kolkata" happily resolves to Gariahat Sarbojanin Durgotsab, several km
 * away. Detect and skip them so tier 2 handles the name instead.
 */
function isNameEcho(name, address) {
  const n = squish(name);
  const a = squish(String(address || "").replace(/\(FFD[^)]*\)/gi, ""));
  return !!n && a.startsWith(n.slice(0, Math.min(14, n.length)));
}

/**
 * "28, Brojen Mukherjee Rd, Chamrapatti, Behala, Kolkata 700034"
 *   -> { street: "Brojen Mukherjee Rd", locality: "Behala" }
 * We keep the last few comma segments as locality candidates, most
 * specific first, and let the geocoder decide which it understands.
 */
function parseAddress(address) {
  const raw = String(address || "").replace(/\(FFD[^)]*\)/gi, "").trim();
  if (!raw) return { candidates: [], outOfArea: false };

  const upper = raw.toUpperCase();
  const outOfArea = OUT_OF_AREA.some((t) => upper.includes(t));
  if (outOfArea) return { candidates: [], outOfArea: true };

  const parts = raw.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  // Drop the trailing "Kolkata 700034" style tail.
  const body = parts.filter((p) => !/\bKOLKATA\b/i.test(p) && !/\b7\d{5}\b/.test(p));
  const chunks = body.filter(stripHouse);
  if (!chunks.length) return { candidates: [], outOfArea: false };

  const candidates = [];
  if (chunks.length >= 2) candidates.push(`${chunks[chunks.length - 2]} ${chunks[chunks.length - 1]}, Kolkata`);
  candidates.push(`${chunks[chunks.length - 1]}, Kolkata`);
  return { candidates, outOfArea: false };
}

/** Only accept a locality we explicitly recognise. Never fuzzy-match names. */
function localityFromName(name) {
  const n = norm(name);
  let best = null;
  for (const g of GAZETTEER) {
    if (n.includes(norm(g)) && (!best || g.length > best.length)) best = g;
  }
  return best;
}

/** Deterministic ~150m offset so metro-fallback pins don't stack on one pixel. */
function jitter(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = ((h % 360) * Math.PI) / 180;
  const r = 0.0011 + ((h >> 9) % 40) / 40000; // 110m - 210m
  return { dLat: Math.sin(a) * r, dLng: Math.cos(a) * r / Math.cos((22.57 * Math.PI) / 180) };
}

const points = JSON.parse(fs.readFileSync(POINTS, "utf8"));
const missing = points.filter((p) => p.lat == null || p.lng == null);
console.log(`missing: ${missing.length} of ${points.length}`);

// Metro centroids first - the fallback depends on them.
const centroids = {};
for (const [metro, query] of Object.entries(METROS)) {
  centroids[metro] = (await geocode(query)) || { lat: 22.57, lng: 88.36, name: query };
}
saveCache();

const report = [];
for (const p of missing) {
  const row = { slug: p.slug, name: p.name, address: p.address, confidence: "none", lat: null, lng: null, query: null };

  // Genuinely out of the metro area - skip entirely rather than place wrongly.
  const raw = String(p.address || "").toUpperCase();
  if (OUT_OF_AREA.some((t) => raw.includes(t))) {
    row.confidence = "excluded-out-of-area";
    report.push(row);
    continue;
  }

  const anchor = centroids[p.nearestMetro] || centroids["Kolkata Metro"];
  const accept = (hit, tier, q) => {
    if (!usable(hit)) return false;
    const drift = kmBetween(anchor, hit);
    if (drift > MAX_DRIFT_KM) {
      row.rejected = `${tier}: "${q}" -> ${hit.name} (${drift.toFixed(1)}km from ${p.nearestMetro})`;
      return false;
    }
    Object.assign(row, { lat: hit.lat, lng: hit.lng, confidence: tier, query: q, matched: hit.name, driftKm: Number(drift.toFixed(1)) });
    return true;
  };

  // --- Tier 1: address-derived locality (only if the address is real) ---
  if (!isNameEcho(p.name, p.address)) {
    const { candidates } = parseAddress(p.address);
    for (const q of candidates) if (accept(await geocode(q), "address", q)) break;
  }

  // --- Tier 2: a locality we explicitly recognise in the name ---
  if (row.lat == null) {
    const loc = localityFromName(p.name);
    if (loc) {
      const q = `${loc}, Kolkata`;
      accept(await geocode(q), "locality", q);
    }
  }

  // --- Tier 3: metro centroid ---
  if (row.lat == null) {
    const c = centroids[p.nearestMetro] || centroids["Kolkata Metro"];
    const j = jitter(p.slug);
    Object.assign(row, {
      lat: c.lat + j.dLat, lng: c.lng + j.dLng, confidence: "metro", query: `${p.nearestMetro} (centroid)`, matched: c.name,
    });
  } else {
    // Precise tiers can still collide when several pandals share one locality
    // ("Behala, Kolkata" resolves to a single point). Spread them a little so
    // they do not render as a single overlapping pin.
    const j = jitter(p.slug + "~tight");
    row.lat += j.dLat * 0.4;
    row.lng += j.dLng * 0.4;
  }
  report.push(row);
}

saveCache();
fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));

// Apply
let applied = 0;
const summary = {};
for (const row of report) {
  summary[row.confidence] = (summary[row.confidence] || 0) + 1;
  if (row.lat == null) continue;
  const target = points.find((x) => x.slug === row.slug);
  if (!target) continue;
  target.lat = Number(row.lat.toFixed(6));
  target.lng = Number(row.lng.toFixed(6));
  target.confidence = row.confidence;
  applied += 1;
}
fs.writeFileSync(POINTS, JSON.stringify(points));

const withCoords = points.filter((p) => p.lat != null).length;
console.log("applied:", applied, JSON.stringify(summary));
console.log("total points with coordinates:", withCoords, "/", points.length);
console.log("API calls this run:", apiCalls);