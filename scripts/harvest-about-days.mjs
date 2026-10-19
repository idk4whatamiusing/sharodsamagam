/**
 * Harvests the About page's "Ritual Journey" day panels from the live original.
 *
 * WHY A SCRIPT AND NOT A HAND COPY
 * The section shows one festival day at a time behind six tabs, and the
 * original keeps all six days in its client component: the static HTML we
 * mirrored only ever carries the one day its render date happened to select
 * (Maha Ashtami today). The other five have to be driven through a browser to
 * be read at all.
 *
 * The original's own button classes are captured too, so the pressed and
 * unpressed states in components/AboutJourney.tsx are theirs rather than
 * invented.
 *
 * Usage: node scripts/harvest-about-days.mjs
 * Writes: data/about-days.json
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE = "https://www.durgapujakolkata.in/about-us";
const OUT = path.join(process.cwd(), "data", "about-days.json");

/** Tab labels, in the order the page shows them. */
const DAYS = ["Mahalaya", "Maha Shasthi", "Maha Saptami", "Maha Ashtami", "Maha Navami", "Bijoya Dashami"];

/**
 * The browser's DOM serialiser rewrites some attributes on the way out
 * (`style="background-color:#D90429"` becomes `rgb(217, 29, 41)`), and React
 * leaves `<!-- -->` separators behind. Normalise both so the harvested panels
 * match the server-rendered markup character for character.
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

const classes = await page.evaluate((days) => {
  const first = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === days[0]);
  if (!first) return null;
  const row = first.parentElement;
  const active = [...row.querySelectorAll("button")].find((b) => b.className.includes("bg-[#D90429]"));
  return { activeClass: active ? active.className : "", inactiveClass: first.className };
}, DAYS);

if (!classes || !classes.activeClass || !classes.inactiveClass) {
  console.error("could not read the tab classes");
  await browser.close();
  process.exit(1);
}
console.log("  active  :", classes.activeClass.slice(0, 80) + "...");
console.log("  inactive:", classes.inactiveClass.slice(0, 80) + "...");

const days = [];
for (const day of DAYS) {
  const html = await page.evaluate(async (label) => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
    if (!button) return null;
    const row = button.parentElement;
    button.click();
    await new Promise((r) => setTimeout(r, 400));
    const frame = row.nextElementSibling;
    return frame && frame.firstElementChild ? frame.firstElementChild.outerHTML : null;
  }, day);
  if (!html) throw new Error(`${day}: panel not found`);
  days.push({ day, html: normalise(html) });
  console.log(`  ${day.padEnd(14)} ${normalise(html).length} chars`);
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      _provenance: {
        source: SOURCE,
        harvested: new Date().toISOString(),
        note:
          "The 'Ritual Journey' day panels. Only one day is server-rendered; all " +
          "six were captured by clicking each tab in a browser. Button classes are " +
          "the original's own pressed/unpressed strings. Re-run " +
          "scripts/harvest-about-days.mjs to refresh.",
      },
      activeClass: classes.activeClass,
      inactiveClass: classes.inactiveClass,
      days,
    },
    null,
    2
  ) + "\n"
);
console.log("\nwrote", OUT);
await browser.close();
