/**
 * Harvests the card tags the original assigns to each pandal.
 *
 * WHY THIS IS NEEDED
 * The directory cards carry tag chips ("award-winner", "theme-based",
 * "famous-for-lighting", ...). Those exist in our mirror only for the 24
 * cards the static scrape captured, and nowhere in data/pandals.json or the
 * per-pandal detail pages. The original shows them on every card, so
 * rendering 752 cards without them would be a visible downgrade from the 24
 * we already have.
 *
 * The original exposes no JSON endpoint for the pandal list - the data rides
 * in the RSC payload and the page reveals more on scroll. So the list has to
 * be scrolled out and read, the same way the panzika panels had to be
 * clicked out.
 *
 * Join key is the slug. The original carries a different set of pandals from
 * ours, so the overlap is reported rather than assumed.
 *
 * Usage: node scripts/harvest-paras-tags.mjs
 * Writes: data/paras-tags.json
 */

import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";

const SOURCE = "https://www.durgapujakolkata.in/paras";
const OUT = path.join(process.cwd(), "data", "paras-tags.json");

/** The tag vocabulary, taken from the cards in our own mirror. */
const KNOWN_TAGS = new Set([
  "award-winner",
  "theme-based",
  "traditional",
  "community-favorite",
  "famous-for-lighting",
  "historical",
]);

const CARD = 'a.block.h-full[href^="/paras/"]';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

console.log("scrolling", SOURCE);
const res = await page.goto(SOURCE, { waitUntil: "networkidle", timeout: 90000 });
if (!res || res.status() >= 400) {
  console.error("source unavailable:", res && res.status());
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(2500);

// The list reveals itself on scroll and stops when its sentinel disappears.
// Poll until the count stops growing, with a stall guard so a changed page
// cannot spin this forever.
let previous = 0;
let stalls = 0;
for (let i = 0; i < 60; i++) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1100);
  const n = await page.evaluate((sel) => document.querySelectorAll(sel).length, CARD);
  if (n === previous) {
    if (++stalls > 6) break;
  } else {
    stalls = 0;
  }
  if (n !== previous) console.log(`  scrolled: ${n} cards`);
  previous = n;
}

const cards = await page.evaluate(
  ({ sel, known }) => {
    const set = new Set(known);
    return [...document.querySelectorAll(sel)].map((a) => {
      const slug = (a.getAttribute("href") || "").split("/").pop() || "";
      const tags = [...a.querySelectorAll("span")]
        .map((s) => (s.textContent || "").trim())
        .filter((t) => set.has(t));
      return { slug, tags };
    });
  },
  { sel: CARD, known: [...KNOWN_TAGS] }
);

await browser.close();

const seen = new Map();
for (const c of cards) {
  if (c.slug && !seen.has(c.slug)) seen.set(c.slug, c.tags);
}

const payload = {
  _provenance: {
    source: SOURCE,
    harvested: new Date().toISOString(),
    note:
      "Card tags read from the original by scrolling its directory. Re-run " +
      "scripts/harvest-paras-tags.mjs to refresh.",
  },
  tags: Object.fromEntries(seen),
};

writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
console.log(`\ncards read: ${cards.length}  unique slugs: ${seen.size}`);

// Report the join against our own dataset so a mismatch is visible rather
// than silently producing tagless cards.
const pandals = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "pandals.json"), "utf8")
);
const matched = pandals.filter((p) => seen.has(p.slug));
const untagged = matched.filter((p) => (seen.get(p.slug) || []).length === 0);

console.log(`our pandals:            ${pandals.length}`);
console.log(`matched on the original: ${matched.length}`);
console.log(`no match (no tags):     ${pandals.length - matched.length}`);
console.log(`matched but untagged:   ${untagged.length}`);
console.log(`\nwrote`, OUT);
if (untagged.length) {
  console.log("untagged sample:", untagged.slice(0, 5).map((p) => p.slug).join(", "));
}