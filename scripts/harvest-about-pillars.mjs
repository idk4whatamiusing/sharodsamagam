import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE = "https://www.durgapujakolkata.in/about-us";
const OUT = path.join(process.cwd(), "data", "about-pillars.json");
const PILLARS = ["Pillar 01", "Pillar 02", "Pillar 03", "Pillar 04"];

function normalise(html) {
  return html
    .replace(/style="background-color: rgb\((\d+), (\d+), (\d+)\);"/g, (_, r, g, b) =>
      `style="background-color:#${[r, g, b].map((n) => Number(n).toString(16).padStart(2, "0").toUpperCase()).join("")}"`
    )
    .replace(/<!--\s*-->|<!--\$-->|<!--\/\$-->/g, "");
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
const res = await page.goto(SOURCE, { waitUntil: "networkidle", timeout: 90000 });
if (!res || res.status() >= 400) { console.error("source unavailable", res && res.status()); await browser.close(); process.exit(1); }
await page.waitForTimeout(2500);
await page.keyboard.press("Escape");
await page.waitForTimeout(1000);

const classes = await page.evaluate((labels) => {
  const first = [...document.querySelectorAll("button")].find((b) => b.textContent.includes(labels[0]));
  if (!first) return null;
  const row = first.parentElement;
  const active = [...row.querySelectorAll("button")].find((b) => b.className.includes("bg-[#1C0D0B]"));
  return { activeClass: active ? active.className : "", inactiveClass: first.className };
}, PILLARS);

if (!classes || !classes.activeClass || !classes.inactiveClass) {
  console.error("could not read pillar tab classes");
  await browser.close();
  process.exit(1);
}

const panels = [];
for (const label of PILLARS) {
  const html = await page.evaluate(async (lbl) => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent.includes(lbl));
    if (!button) return null;
    const row = button.parentElement;
    button.click();
    await new Promise((r) => setTimeout(r, 500));
    const frame = row?.nextElementSibling;
    return frame && frame.firstElementChild ? frame.firstElementChild.outerHTML : null;
  }, label);
  if (!html) throw new Error(`${label}: panel not found`);
  panels.push({ day: label, html: normalise(html) });
  console.log(`${label.padEnd(12)} ${normalise(html).length} chars`);
}

writeFileSync(OUT, JSON.stringify({
  _provenance: { source: SOURCE, harvested: new Date().toISOString(), note: "Four Sacred Pillars panels harvested by clicking each tab." },
  activeClass: classes.activeClass,
  inactiveClass: classes.inactiveClass,
  days: panels
}, null, 2) + "\n");
console.log("wrote", OUT);
await browser.close();
