/**
 * Harvests the /paras directory's client-rendered controls from the live original.
 *
 * WHY A SCRIPT AND NOT A HAND COPY
 * The sort dropdown and the Featured/Saved chips are React state on the
 * original: the listbox's markup only exists while it is open, and a chip's
 * pressed class string only exists while it is pressed. A static scrape kept
 * the button ("Popular") and the unpressed chips, so the dropdown was a dead
 * control and the chips never moved their highlight.
 *
 * The original's own class strings are captured so components/
 * ParasInteractions.tsx reproduces their pressed and unpressed looks rather
 * than inventing them.
 *
 * Usage: node scripts/harvest-paras-ui.mjs
 * Writes: data/paras-ui.json
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE = "https://www.durgapujakolkata.in/paras";
const OUT = path.join(process.cwd(), "data", "paras-ui.json");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

console.log("fetching", SOURCE);
const res = await page.goto(SOURCE, { waitUntil: "networkidle", timeout: 90000 });
if (!res || res.status() >= 400) {
  console.error("source unavailable:", res && res.status());
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(3000);

const ui = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const chip = (label) =>
    [...document.querySelectorAll("button")].find((b) =>
      (b.textContent || "").trim().toLowerCase().startsWith(label.toLowerCase())
    );
  const snap = (label) => {
    const b = chip(label);
    return { cls: b.className, svg: b.querySelector("svg")?.getAttribute("class") || "" };
  };

  // ---- sort dropdown -------------------------------------------------
  const sortBtn = [...document.querySelectorAll("button")].find((b) =>
    /Popular/.test(b.textContent || "")
  );
  sortBtn.click();
  await wait(800);
  const box = document.querySelector('[role="listbox"]');
  const opts = [...box.querySelectorAll('[role="option"]')];
  const sort = {
    options: opts.map((o) => o.textContent.replace(/\s+/g, " ").trim()),
    listboxClass: box.className,
    optionClass: opts[1].className,
    optionActiveClass: opts[0].className,
    checkSvgPath: opts[0].querySelector("svg path")?.getAttribute("d") || "",
  };
  sortBtn.click(); // close again
  await wait(400);

  // ---- Featured / Saved chips ---------------------------------------
  const featuredInactive = snap("Featured");
  chip("Featured").click();
  await wait(800);
  const featuredActive = snap("Featured");
  const savedInactive = snap("Saved");
  chip("Saved").click();
  await wait(800);
  const savedActive = snap("Saved");

  return { sort, chips: { featuredActive, featuredInactive, savedActive, savedInactive } };
});

console.log("  sort options :", ui.sort.options.join(" | "));
console.log("  featured on  :", ui.chips.featuredActive.cls.slice(-70));
console.log("  saved on     :", ui.chips.savedActive.cls.slice(-70));

writeFileSync(
  OUT,
  JSON.stringify(
    {
      _provenance: {
        source: SOURCE,
        harvested: new Date().toISOString(),
        note:
          "The /paras sort listbox (opened in a browser to read its options and " +
          "classes) and the Featured/Saved chips' own pressed and unpressed class " +
          "strings. Re-run scripts/harvest-paras-ui.mjs to refresh.",
      },
      ...ui,
    },
    null,
    2
  ) + "\n"
);
console.log("\nwrote", OUT);
await browser.close();
