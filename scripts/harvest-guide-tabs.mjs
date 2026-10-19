/**
 * Harvests the guide index's topic tabs from the live original.
 *
 * WHY A SCRIPT AND NOT A HAND COPY
 * /guide shows one topic at a time behind five pills ("Getting Around &
 * Metro", "Where to Stay", ...). The static scrape kept the pill row and
 * whichever panel the original server-rendered (Getting Around & Metro); the
 * other four live in its client component, so the pills shipped as dead
 * buttons with nothing to reveal.
 *
 * The first tab is deliberately not harvested: our mirror's copy of it is the
 * one lib/metroInject.ts rewrites to hold the transit map, and the live page
 * only carries a Leaflet canvas there.
 *
 * The original's own pill classes are captured too, so the pressed and
 * unpressed states in components/GuideTabs.tsx are theirs rather than
 * invented.
 *
 * Usage: node scripts/harvest-guide-tabs.mjs
 * Writes: data/guide-tabs.json
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE = "https://www.durgapujakolkata.in/guide";
const OUT = path.join(process.cwd(), "data", "guide-tabs.json");

/**
 * The browser's DOM serialiser rewrites some attributes on the way out, and
 * React leaves `<!-- -->` separators behind. Normalise both so the harvested
 * panels match the server-rendered markup character for character.
 */
function normalise(html) {
  return html
    .replace(
      /style="background-color: rgb\((\d+), (\d+), (\d+)\);"/g,
      (_, r, g, b) =>
        `style="background-color:#${[r, g, b].map((n) => Number(n).toString(16).padStart(2, "0").toUpperCase()).join("")}"`
    )
    .replace(/<!--\s*-->|<!--\$-->|<!--\/\$-->/g, "");
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });

console.log("fetching", SOURCE);
const res = await page.goto(SOURCE, { waitUntil: "networkidle", timeout: 90000 });
if (!res || res.status() >= 400) {
  console.error("source unavailable:", res && res.status());
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(2500);

const meta = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find(
    (b) => (b.textContent || "").trim() === "Where to Stay"
  );
  if (!btn) return null;
  const row = btn.parentElement;
  const buttons = [...row.querySelectorAll(":scope > button")];
  const active = buttons.find((b) => b.className.includes("bg-[#D90429]"));
  const inactive = buttons.find((b) => !b.className.includes("bg-[#D90429]"));
  return {
    rowClass: row.className,
    labels: buttons.map((b) => b.textContent.replace(/\s+/g, " ").trim()),
    activeClass: active ? active.className : "",
    inactiveClass: inactive ? inactive.className : "",
  };
});

if (!meta || !meta.activeClass || !meta.inactiveClass || meta.labels.length < 2) {
  console.error("could not read the tab row", meta);
  await browser.close();
  process.exit(1);
}
console.log("  labels :", meta.labels.join(" | "));

const panels = [];
for (const label of meta.labels.slice(1)) {
  const r = await page.evaluate(async (label) => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => (b.textContent || "").trim() === label
    );
    if (!btn) return null;
    btn.click();
    await new Promise((r2) => setTimeout(r2, 800));
    // Re-query: React may have re-rendered the row when the pressed class moved.
    const fresh = [...document.querySelectorAll("button")].find(
      (b) => (b.textContent || "").trim() === label
    );
    const row = fresh.parentElement;
    const panel = row.nextElementSibling;
    if (!panel) return null;
    return { cls: panel.className, html: panel.innerHTML };
  }, label);
  if (!r) {
    console.error(`  ${label}: panel not found`);
    await browser.close();
    process.exit(1);
  }
  panels.push({ label, cls: r.cls, html: normalise(r.html) });
  console.log(`  ${label.padEnd(24)} ${normalise(r.html).length} chars (panel class: ${r.cls})`);
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      _provenance: {
        source: SOURCE,
        harvested: new Date().toISOString(),
        note:
          "The guide topic tabs. Four panels were captured by clicking each pill " +
          "in a browser; the first pill's panel is skipped because our mirror's " +
          "copy is the one the transit map is injected into. Pill classes are the " +
          "original's own pressed/unpressed strings. Re-run " +
          "scripts/harvest-guide-tabs.mjs to refresh.",
      },
      firstTab: meta.labels[0],
      activeClass: meta.activeClass,
      inactiveClass: meta.inactiveClass,
      rowClass: meta.rowClass,
      panels,
    },
    null,
    2
  ) + "\n"
);
console.log("\nwrote", OUT);
await browser.close();
