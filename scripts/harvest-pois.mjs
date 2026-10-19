/**
 * Harvests the Points of Interest directory from the live original.
 *
 * WHY A SCRIPT AND NOT A HAND COPY
 * The page server-renders 119 places and then fetches /api/pois on mount,
 * replacing the list with the full 273 - that is the directory a visitor
 * actually browses, but none of it is in the HTML a scrape can keep. The
 * cards' own markup is captured from the live DOM and tokenised ({{name}},
 * {{address}}, {{phone}}, {{lat}}, {{lng}}, {{hours}}), so lib/poiInject.ts
 * renders all 273 from the original's templates rather than from markup
 * copied by hand. The category chips' pressed/unpressed classes and the
 * "No Facilities Found" empty state are captured the same way.
 *
 * Two template variants are taken per category: one for places with a phone
 * number and one without, since that is the only optional row.
 *
 * Usage: node scripts/harvest-pois.mjs
 * Writes: data/pois.json
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE = "https://www.durgapujakolkata.in/points-of-interest";
const API = "https://www.durgapujakolkata.in/api/pois";
const OUT = path.join(process.cwd(), "data", "pois.json");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

console.log("fetching", SOURCE);
const res = await page.goto(SOURCE, { waitUntil: "domcontentloaded", timeout: 90000 });
if (!res || res.status() >= 400) {
  console.error("source unavailable:", res && res.status());
  await browser.close();
  process.exit(1);
}

// Wait for the live list: the page swaps in the API's 273 places on mount.
console.log("waiting for the live list (273 places)...");
await page.waitForFunction(() => document.querySelectorAll("h3").length > 200, null, {
  timeout: 60000,
}).catch(() => {});
await page.waitForTimeout(1500);
const liveCount = await page.evaluate(() => document.querySelectorAll("h3").length);
console.log("  live cards:", liveCount);
if (liveCount < 200) {
  console.error("live list never arrived; refusing to harvest the server-rendered 119");
  await browser.close();
  process.exit(1);
}

// 1. Categories from the bundles: the id/label table is bundled, not rendered
//    (the chips only carry labels), so read it out of the page's own modules.
const categories = await page.evaluate(async () => {
  const srcs = [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));
  const found = [];
  for (const src of srcs) {
    if (!src.includes("/_next/static/chunks/")) continue;
    try {
      const text = await (await fetch(src)).text();
      const re = /\{id:"([a-z-]+)",label:"([^"]+)"\}/g;
      let m;
      while ((m = re.exec(text))) found.push({ id: m[1], label: m[2] });
    } catch {
      /* a chunk that will not load is not fatal: the labels are cross-checked below */
    }
  }
  return found;
});
const uniqueCategories = [...new Map(categories.map((c) => [c.id, c])).values()];
console.log("  categories:", uniqueCategories.length, uniqueCategories.map((c) => c.id).join(", "));
if (uniqueCategories.length < 13) {
  console.error("could not read the category table from the page's bundles");
  await browser.close();
  process.exit(1);
}

// 2. Chips: labels, icons and the pressed/unpressed classes.
const chips = await page.evaluate(() => {
  const all = [...document.querySelectorAll("button")].find((b) =>
    (b.textContent || "").trim().startsWith("All (")
  );
  if (!all) return null;
  const row = all.parentElement;
  const buttons = [...row.querySelectorAll("button")];
  const active = buttons.find((b) => b.className.includes("bg-[#D90429]"));
  const inactive = buttons.find((b) => !b.className.includes("bg-[#D90429]"));
  return {
    activeClass: active ? active.className : "",
    inactiveClass: inactive ? inactive.className : "",
    labels: buttons.map((b) => ((b.querySelector("span") || {}).textContent || "").trim()),
    allLabel: (all.querySelector("span") || {}).textContent.trim(),
  };
});
if (!chips || !chips.activeClass || !chips.inactiveClass) {
  console.error("could not read the chip row");
  await browser.close();
  process.exit(1);
}
console.log("  chips:", chips.labels.join(" | "));

// 3. Card templates per category, in the two phone variants.
//
// The template is taken by cloning a live card and replacing its own values
// with tokens at the exact nodes that carry them (name in the h3, address in
// the first paragraph's span, and so on), so no text ever has to be matched
// by substring. Every card is then re-rendered from the template in the page
// itself and its text and map link compared with the live card's, which is
// what makes it safe to render all 273 places from thirteen templates.
const templates = await page.evaluate((labels) => {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const T = (el) => ((el && el.textContent) || "").replace(/\s+/g, " ").trim();

  const cards = [...document.querySelectorAll("h3")]
    .map((h) => h.closest('div[class*="bg-[#FFFBF0]"]'))
    .filter(Boolean);

  const readRows = (card) => {
    const paragraphs = [...card.children].filter((c) => c.tagName === "P");
    const phoneRow = paragraphs.find((p) => p.querySelector('a[href^="tel:"]'));
    const hoursRow = paragraphs[paragraphs.length - 1];
    const addressRow = paragraphs[0];
    return { addressRow, phoneRow, hoursRow };
  };

  const readValues = (card) => {
    const { addressRow, phoneRow, hoursRow } = readRows(card);
    const mapLink = card.querySelector('a[href^="/map?"]');
    const href = mapLink ? mapLink.getAttribute("href") : "";
    const m = href.match(/lat=([-\d.]+)&(?:amp;)?lng=([-\d.]+)/);
    if (!m) return null;
    return {
      name: T(card.querySelector("h3")),
      address: T(addressRow && addressRow.querySelector("span")),
      phone: phoneRow ? T(phoneRow.querySelector("a")) : "",
      hours: T(hoursRow && hoursRow.querySelector("span")),
      lat: m[1],
      lng: m[2],
    };
  };

  const tokenise = (card) => {
    const v = readValues(card);
    if (!v || !v.name || !v.address || !v.hours) return null;
    const clone = card.cloneNode(true);
    const { addressRow, phoneRow, hoursRow } = readRows(clone);
    const mapLink = clone.querySelector('a[href^="/map?"]');
    clone.querySelector("h3").textContent = "{{name}}";
    addressRow.querySelector("span").textContent = "{{address}}";
    hoursRow.querySelector("span").textContent = "{{hours}}";
    if (phoneRow) {
      const a = phoneRow.querySelector("a");
      a.setAttribute("href", "tel:{{phone}}");
      a.textContent = "{{phone}}";
    }
    // setAttribute stores this literally, so the ampersand has to be bare:
    // the serialiser escapes it once, and the browser decodes it back to "&"
    // when the built page parses the attribute.
    mapLink.setAttribute("href", "/map?lat={{lat}}&lng={{lng}}");
    return clone.outerHTML;
  };

  // Rebuilds a card from a template and returns the element, so both its text
  // and its map link can be compared with the live card's.
  const fill = (tpl, v) => {
    const holder = document.createElement("div");
    holder.innerHTML = tpl
      .split("{{name}}")
      .join(esc(v.name))
      .split("{{address}}")
      .join(esc(v.address))
      .split("{{phone}}")
      .join(esc(v.phone))
      .split("{{lat}}")
      .join(v.lat)
      .split("{{lng}}")
      .join(v.lng)
      .split("{{hours}}")
      .join(esc(v.hours));
    return holder;
  };

  const out = {};
  const mismatches = [];
  const unknownChips = new Set();
  for (const card of cards) {
    const v = readValues(card);
    if (!v) {
      mismatches.push({ card: T(card.querySelector("h3")), why: "unreadable" });
      continue;
    }
    const chip = card.querySelector("span");
    const chipText = (chip ? T(chip) : "").toLowerCase();
    // The card chips usually echo the filter label ("metro station"), but a
    // few use the category id instead ("accommodation", "help desk", "atm"),
    // so accept either form.
    const category = labels.find((l) =>
      [l.label.toLowerCase(), l.id, l.id.replace(/-/g, " ")].includes(chipText)
    );
    if (!category) {
      unknownChips.add(chipText);
      continue;
    }
    const key = v.phone ? "withPhone" : "noPhone";
    const bucket = (out[category.id] ??= { withPhone: null, noPhone: null });
    if (!bucket[key]) bucket[key] = tokenise(card);
    const holder = bucket[key] ? fill(bucket[key], v) : null;
    const liveHref = card.querySelector('a[href^="/map?"]').getAttribute("href");
    const madeHref = holder?.querySelector('a[href^="/map?"]')?.getAttribute("href");
    if (!holder || T(holder) !== T(card) || madeHref !== liveHref) {
      mismatches.push({ card: v.name, category: category.id, why: "template mismatch" });
    }
  }
  return { templates: out, mismatches, unknownChips: [...unknownChips] };
}, uniqueCategories);
const templateData = templates.templates;
console.log(
  "  templates:",
  Object.entries(templateData)
    .map(([id, v]) => `${id}${v.withPhone ? "+phone" : ""}`)
    .join(", ")
);
if (templates.unknownChips.length) {
  console.error("cards with unrecognised category chips:", templates.unknownChips.join(", "));
  await browser.close();
  process.exit(1);
}
if (templates.mismatches.length) {
  console.error(
    "cards that would not re-render from their template:",
    JSON.stringify(templates.mismatches.slice(0, 10)),
    `(${templates.mismatches.length} total)`
  );
  await browser.close();
  process.exit(1);
}
console.log("  every live card re-renders from its template, text and link matching");

// 4. The live dataset itself.
const apiRes = await page.request.get(API);
const api = await apiRes.json();
const pois = Array.isArray(api) ? api : api.pois;
if (!Array.isArray(pois) || pois.length < 200) {
  console.error("api/pois returned", pois && pois.length);
  await browser.close();
  process.exit(1);
}
console.log("  api places:", pois.length);

// 5. The empty state, which only exists once a search matches nothing.
const emptyState = await page.evaluate(async () => {
  const input = document.querySelector("input[placeholder*=Search]");
  if (!input) return null;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, "zzzzqq");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));
  const heading = [...document.querySelectorAll("h4")].find((h) =>
    h.textContent.includes("No Facilities Found")
  );
  if (!heading) return null;
  let node = heading;
  while (node && !(node.className || "").includes("p-10")) node = node.parentElement;
  return node ? node.outerHTML : null;
});
if (!emptyState) {
  console.error("could not capture the empty state");
  await browser.close();
  process.exit(1);
}
console.log("  empty state:", emptyState.length, "chars");

// Every place must have the fields its template needs.
for (const p of pois) {
  if (!p.name || !p.address || !p.openHours || p.lat == null || p.lng == null) {
    console.error("incomplete place:", p.id);
    await browser.close();
    process.exit(1);
  }
  const tpl = templateData[p.category];
  if (!tpl || (!tpl.withPhone && !tpl.noPhone)) {
    console.error("no template for category", p.category);
    await browser.close();
    process.exit(1);
  }
  if (p.phone && !tpl.withPhone) {
    console.error("place has a phone but its category has no phone template:", p.id);
    await browser.close();
    process.exit(1);
  }
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      _provenance: {
        source: SOURCE,
        api: "/api/pois",
        harvested: new Date().toISOString(),
        note:
          "The directory's full live list (the page renders 119 server-side and " +
          "swaps in these on mount), its category chips, per-category card " +
          "templates tokenised from the live DOM, and the empty state. Re-run " +
          "scripts/harvest-pois.mjs to refresh.",
      },
      categories: uniqueCategories,
      chipClasses: { active: chips.activeClass, inactive: chips.inactiveClass },
      templates: templateData,
      emptyState,
      pois,
    },
    null,
    2
  ) + "\n"
);
console.log("\nwrote", OUT);
await browser.close();
