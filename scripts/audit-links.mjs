/**
 * Crawls the built site and reports every internal link that does not resolve.
 *
 * WHY
 * The mirror is a static scrape of someone else's site, so its links point at
 * pages that exist there and may not exist here - /admin/login, /login and
 * /profile were all shipped as navigation and all 404'd. Nothing in the build
 * catches that: Next prerenders whatever the mirror holds, and a link is just
 * markup. This walks the real pages, collects every internal destination they
 * offer, and asks the server for each one.
 *
 * The crawl follows links only within the pages it starts from, so it covers
 * what a visitor can actually reach rather than all 800-odd routes.
 *
 * Usage: node scripts/audit-links.mjs [base-url]
 */

import { chromium } from "playwright";

const B = process.argv[2] || process.env.BASE || "http://127.0.0.1:4173";

// Entry points chosen to cover the different families of page: the chrome
// (header, footer, and the mobile menu) appears on all of them, but each page
// carries its own body links.
const SEEDS = [
  "/",
  "/paras/",
  "/gallery/",
  "/panzika/",
  "/events/",
  "/procession/",
  "/map/",
  "/guide/",
  "/guide/navigating-kolkata/",
  "/guide/accommodation/",
  "/guide/emergency/",
  "/guide/etiquette/",
  "/guide/food-trail/",
  "/guide/photography/",
  "/about-us/",
  "/connect/",
  "/chronicles/",
  "/announcements/",
  "/points-of-interest/",
  "/eden-gardens-live/",
  "/upload/",
  "/copyright/",
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

/** Every internal href the given page offers, normalised to a site path. */
async function linksOn(path) {
  await page.goto(B + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  return page.evaluate(() => {
    const out = new Set();
    for (const a of document.querySelectorAll("a[href]")) {
      const raw = a.getAttribute("href");
      if (!raw) continue;
      // Skip anything that leaves the site or is not a navigation.
      if (/^(mailto:|tel:|javascript:|data:|#)/i.test(raw)) continue;
      let u;
      try {
        u = new URL(raw, location.origin);
      } catch {
        continue;
      }
      if (u.origin !== location.origin) continue;
      out.add(u.pathname + (u.search || ""));
    }
    return [...out];
  });
}

const found = new Map(); // path -> Set of pages linking to it
let seedErrors = 0;
for (const seed of SEEDS) {
  let hrefs;
  try {
    hrefs = await linksOn(seed);
  } catch (e) {
    console.log(`  SEED FAILED ${seed}: ${e.message.split("\n")[0]}`);
    seedErrors++;
    continue;
  }
  for (const h of hrefs) {
    if (!found.has(h)) found.set(h, new Set());
    found.get(h).add(seed);
  }
}

console.log(`\ncrawled ${SEEDS.length - seedErrors}/${SEEDS.length} pages, found ${found.size} distinct internal links\n`);

const bad = [];
const seen = new Map();
for (const [href, sources] of [...found].sort()) {
  const [path, query] = href.split("?");
  let status = seen.get(path);
  if (status === undefined) {
    // Redirects are followed on purpose: the site sets trailingSlash, so
    // /paras answers 301 to /paras/, and a redirect is not a broken link.
    const res = await page.request.get(B + path);
    status = res.status();
    seen.set(path, status);
  }
  if (status !== 200) {
    bad.push({ href, status, from: [...sources] });
  }
  if (query) {
    // A query string is client-side state; only the path can be requested.
  }
}

if (!bad.length) {
  console.log("no broken internal links");
} else {
  console.log(`${bad.length} broken internal link(s):\n`);
  for (const b of bad) {
    console.log(`  ${String(b.status).padEnd(4)} ${b.href}`);
    console.log(`       linked from: ${b.from.slice(0, 4).join(", ")}${b.from.length > 4 ? ` (+${b.from.length - 4})` : ""}`);
  }
}

await browser.close();
process.exit(bad.length || seedErrors ? 1 : 0);
