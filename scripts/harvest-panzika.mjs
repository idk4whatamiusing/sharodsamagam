/**
 * Harvests the Panzika content from the live original site.
 *
 * WHY A SCRIPT AND NOT A HAND COPY
 * The original renders its day panels client-side, so the static HTML we
 * mirrored at build time only ever captured one panel (and a stale one at
 * that - it froze on Maha Ashtami while the original now defaults to
 * Maha Saptami 2). Everything below exists only after JavaScript runs, so it
 * has to be driven through a browser to be read at all.
 *
 * Running this again re-reads the original, so if their copy changes we can
 * refresh instead of re-typing Bengali prose by hand and getting it subtly
 * wrong.
 *
 * Usage: node scripts/harvest-panzika.mjs
 * Writes: data/panzika.json
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE = "https://www.durgapujakolkata.in/panzika";
const OUT = path.join(process.cwd(), "data", "panzika.json");

/** Calendar cells that carry a festival marker, in festival order. */
const DAYS = [
  { day: 10, key: "mahalaya" },
  { day: 16, key: "shashthi" },
  { day: 17, key: "saptami1" },
  { day: 18, key: "saptami2" },
  { day: 19, key: "ashtami" },
  { day: 20, key: "nabami" },
  { day: 21, key: "dashami" },
];

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

/** Reads the currently selected day panel off the original. */
async function readPanel() {
  return page.evaluate(() => {
    const T = (el) => ((el && el.innerText) || "").replace(/\s+/g, " ").trim();

    // The panel is anchored by its heading, e.g. "সপ্তমী (Saptami)". Climbing
    // to the container that holds the ritual table keeps this working even if
    // the markup around it is restyled.
    const head = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,div,p,span")].find(
      (e) =>
        /^\S+\s*\((Saptami|Ashtami|Nabami|Dashami|Shashthi|Amavasya)\)$/.test(T(e)) &&
        T(e).length < 60
    );
    if (!head) return { error: "panel heading not found" };

    let panel = head;
    for (let i = 0; i < 6 && panel.parentElement; i++) {
      panel = panel.parentElement;
      if (/নির্ঘণ্ট/.test(T(panel)) && T(panel).length > 400) break;
    }
    if (!/নির্ঘণ্ট/.test(T(panel))) return { error: "panel body not found" };

    const desc = panel.children[2];
    const ritesBox = panel.children[4];
    const titleLine = T(panel.children[1]);

    // "সপ্তমী (Saptami)" and the date can sit on one line or two.
    const titleMatch = titleLine.match(
      /^(.*?)\s*\(([A-Za-z]+)\)\s*(.*)$/
    );

    // Ritual rows: a container whose children each hold two text cells.
    let rowsBox = ritesBox.children[1];
    let rows = [];
    for (let depth = 0; depth < 4 && rowsBox; depth++) {
      const kids = [...rowsBox.children];
      if (kids.length >= 2 && kids.every((k) => k.children.length >= 2)) {
        rows = kids.map((r) => [
          T(r.children[0]),
          T(r.children[1]),
        ]);
        break;
      }
      const next = kids.find((k) => k.children.length >= 2);
      if (!next) break;
      rowsBox = next;
    }

    return {
      bnName: titleMatch ? titleMatch[1].trim() : "",
      enName: titleMatch ? titleMatch[2].trim() : "",
      longDate: titleMatch ? titleMatch[3].trim() : "",
      subtitleBn: desc ? T(desc.children[0]) : "",
      narrativeBn: desc ? T(desc.children[1]) : "",
      tithiTiming: T(panel.children[3]).replace(/^তিথি\s*সময়\s*:\s*/, ""),
      ritesHeading: ritesBox ? T(ritesBox.children[0]) : "",
      rites: rows,
    };
  });
}

/** Clicks a numbered calendar cell that carries a festival marker. */
async function selectDay(n) {
  const clicked = await page.evaluate((num) => {
    const cells = [...document.querySelectorAll("button")].filter((b) => {
      const s = ((b.innerText || "") + "").replace(/\s+/g, " ").trim();
      return (
        s.startsWith(num + " ") &&
        /Mahalaya|Shashthi|Saptami|Ashtami|Nabami|Dashami/i.test(s)
      );
    });
    if (!cells.length) return false;
    cells[cells.length - 1].click();
    return true;
  }, n);
  if (!clicked) throw new Error("no calendar cell for day " + n);
  await page.waitForTimeout(900);
}

const days = [];
for (const { day, key } of DAYS) {
  await selectDay(day);
  const panel = await readPanel();
  if (panel.error) throw new Error(`day ${day}: ${panel.error}`);
  if (!panel.rites.length) throw new Error(`day ${day}: no ritual rows parsed`);
  days.push({ key, day, ...panel });
  console.log(
    `  ${String(day).padStart(2)} ${key.padEnd(9)} ${panel.bnName} (${panel.enName})` +
      ` - ${panel.rites.length} rites`
  );
}

// The almanac is a second view behind the "Traditional Almanac Table" toggle.
// It is a stack of cards, one per festival day, each with the Bengali month
// name and a tithi end time - the traditional almanac entry the calendar
// grid does not carry.
const almanacToggled = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) =>
    /Traditional Almanac/i.test(b.innerText || "")
  );
  if (!btn) return false;
  btn.click();
  return true;
});
if (!almanacToggled) throw new Error("almanac toggle missing");
await page.waitForTimeout(1500);

const almanac = await page.evaluate(() => {
  const T = (el) => ((el && el.innerText) || "").replace(/\s+/g, " ").trim();

  // Smallest container that still holds the full almanac: the cards are
  // direct children, each with its own rounded border.
  const cards = [...document.querySelectorAll("div")].filter(
    (e) =>
      (e.className || "").toString().includes("rounded-2xl") &&
      /কার্তিক|আশ্বিন/.test(T(e))
  );
  const boxes = cards.map((c) => c.parentElement);
  const counts = new Map();
  boxes.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
  // The almanac wrapper is the parent that collects the most cards.
  let wrapper = null;
  let best = 0;
  counts.forEach((n, el) => {
    if (n > best) {
      best = n;
      wrapper = el;
    }
  });
  if (!wrapper) return [];

  return [...wrapper.children]
    .filter((c) => /কার্তিক|আশ্বিন/.test(T(c)))
    .map((card) => {
      const T = (el) => ((el && el.textContent) || "").replace(/\s+/g, " ").trim();
      const head = card.children[0] || {};
      const titleBlock = head.children[0] || {};
      const timingBlock = (card.children[1] || {}).children?.[1] || {};
      const dm = T(titleBlock.children[1]).match(/^(.*?)\s*·\s*(.*)$/);
      return {
        titleBn: T(titleBlock.children[0]),
        dateEn: dm ? dm[1] : T(titleBlock.children[1]),
        bengaliMonth: dm ? dm[2] : "",
        tithiName: T(head.children[1]),
        tagline: T((card.children[1] || {}).children?.[0]),
        timingHeading: T(timingBlock.children[0]),
        timing: T(timingBlock.children[1]),
        guidance: [...(card.children[2] || {}).children]
          .map((n) => T(n))
          .filter(Boolean),
      };
    });
});

console.log(`  almanac: ${almanac.length} entries`);
for (const e of almanac) {
  console.log(`    ${e.dateEn.padEnd(18)} ${e.bengaliMonth.padEnd(10)} ${e.timingHeading}`);
}

const payload = {
  _provenance: {
    source: SOURCE,
    harvested: new Date().toISOString(),
    note:
      "Client-rendered on the original; harvested through a browser. Re-run " +
      "scripts/harvest-panzika.mjs to refresh.",
  },
  almanac,
  days,
};

writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
console.log("\nwrote", OUT);
await browser.close();