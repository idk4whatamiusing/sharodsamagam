/**
 * Harvests per-route page metadata from the original.
 *
 * WHY
 * The mirror holds page bodies only - the scrape stripped <head> - so every
 * page in our build inherits the single title in the root layout. The original
 * gives each route its own title, description and social card, and they are
 * real content rather than boilerplate: "<pandal name> - Kolkata Durga Puja
 * 2026" for each of the 776 directory pages, "Durga Puja Photo Gallery 2026 |
 * High-Resolution Kolkata Puja Images & Idols" for /gallery. Browser tabs,
 * bookmarks and search results all read them, and so do link previews in
 * WhatsApp and Facebook, which is how a festival site actually gets shared.
 *
 * HOW
 * The metadata is server-rendered, so a plain HTTP GET is enough: no browser
 * and no rendering, just one request per route. Requests run a few at a time
 * to stay a polite visitor rather than a flood.
 *
 * Two things are normalised on the way in. Their absolute URLs point at their
 * own host, which we must not advertise, so they become site-relative paths.
 * And their og:site_name is left out entirely - the brand is ours.
 *
 * Usage: node scripts/harvest-meta.mjs
 * Writes: data/meta.json
 */

import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ORIGIN = "https://www.durgapujakolkata.in";
const OUT = path.join(process.cwd(), "data", "meta.json");
const CONCURRENCY = 4;

const MIRROR = path.join(process.cwd(), "mirror");

/** Every route we serve, in the same shape listRoutes() uses. */
function routes() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html") && !e.name.startsWith("_")) {
        out.push(path.relative(MIRROR, p).replace(/\.html$/, ""));
      }
    }
  };
  walk(MIRROR);
  return out;
}

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#x27": "'",
  "#x2F": "/",
};

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z#0-9x]+);/gi, (m, name) => ENTITIES[name] ?? m)
    .replace(/\s+/g, " ")
    .trim();

/** Reads one attribute from the page's <head>. */
function tag(html, re) {
  const m = html.match(re);
  return m ? decode(m[1]) : "";
}

/**
 * Their host becomes our paths. og:url and og:image are absolute on the
 * original; leaving them alone would point link previews at their domain.
 */
function localise(url) {
  if (!url) return "";
  return url.replace(/^https?:\/\/(www\.)?durgapujakolkata\.in/, "") || "/";
}

async function fetchMeta(route, attempt = 1) {
  const url = ORIGIN + (route === "index" ? "" : "/" + route);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Sharodsamagam-mirror/1.0 (metadata harvest)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    const title = tag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!title) throw new Error("no <title>");
    return {
      title,
      description: tag(html, /<meta\s+name="description"\s+content="([^"]*)"/i),
      ogTitle: tag(html, /<meta\s+property="og:title"\s+content="([^"]*)"/i),
      ogDescription: tag(html, /<meta\s+property="og:description"\s+content="([^"]*)"/i),
      ogImage: localise(tag(html, /<meta\s+property="og:image"\s+content="([^"]*)"/i)),
      ogLocale: tag(html, /<meta\s+property="og:locale"\s+content="([^"]*)"/i),
    };
  } catch (e) {
    if (attempt >= 3) throw e;
    await new Promise((r) => setTimeout(r, 400 * attempt));
    return fetchMeta(route, attempt + 1);
  }
}

const all = routes();
console.log(`harvesting metadata for ${all.length} routes, ${CONCURRENCY} at a time`);

const routesMeta = {};
let done = 0;
let failed = 0;
const queue = [...all];

async function worker() {
  while (queue.length) {
    const route = queue.shift();
    try {
      routesMeta[route] = await fetchMeta(route);
    } catch (e) {
      failed++;
      console.log(`  FAILED ${route}: ${e.message}`);
    }
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${all.length}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// The guide sub-pages legitimately share their section's title, but a title
// that repeats across the whole site is the bug being fixed here, so the
// spread is reported rather than assumed.
const distinct = new Set(Object.values(routesMeta).map((m) => m.title));
console.log(`\ncollected ${Object.keys(routesMeta).length} of ${all.length} routes (${failed} failed)`);
console.log(`distinct titles: ${distinct.size}`);
console.log(`with a description: ${Object.values(routesMeta).filter((m) => m.description).length}`);
console.log(`with an og:image: ${Object.values(routesMeta).filter((m) => m.ogImage).length}`);

const branded = Object.entries(routesMeta).filter(([, m]) =>
  /Sharodotsav|durgapujakolkata/i.test(m.title + m.ogTitle + m.ogImage)
);
if (branded.length) {
  console.log(`\n${branded.length} route(s) still name the original brand or host:`);
  branded.slice(0, 5).forEach(([r, m]) => console.log(`  ${r}: ${m.title}`));
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      _provenance: {
        source: ORIGIN,
        harvested: new Date().toISOString(),
        routes: Object.keys(routesMeta).length,
        note:
          "Per-route <title>, description and social card copy, read from the " +
          "original's server-rendered head. Absolute URLs on their host are " +
          "rewritten to site-relative paths. Re-run scripts/harvest-meta.mjs " +
          "to refresh.",
      },
      routes: routesMeta,
    },
    null,
    2
  ) + "\n"
);
console.log("\nwrote", OUT);
