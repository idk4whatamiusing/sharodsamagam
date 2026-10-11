import { chromium } from "playwright";

const B = process.env.BASE || "https://sharodsamagam.dsjzcjmsh6.workers.dev";
const pages = ["/", "/paras/", "/map/", "/paras/maddox-square-durga-pujo/"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

for (const p of pages) {
  const page = await ctx.newPage();
  const errs = [];
  const bad = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 160)));
  page.on("response", (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url().slice(-60)}`));
  await page.goto(B + p, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);
  const probe = await page.evaluate(() => ({
    leafletPane: !!document.querySelector(".leaflet-pane"),
    tilesLoaded: document.querySelectorAll(".leaflet-tile-loaded").length,
    markers: document.querySelectorAll(".leaflet-overlay-pane path").length,
    markerImgs: document.querySelectorAll(".leaflet-marker-icon").length,
    brokenImgs: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0).length,
    totalImgs: document.querySelectorAll("img").length,
    playerOpen: !!document.querySelector(".pujar-aalo-panel:not([style*='display: none'])"),
    cards: document.querySelectorAll("[data-slug]").length,
  }));
  console.log("\n=== " + p + " ===");
  console.log(" probe:", JSON.stringify(probe));
  console.log(" errors:", errs.length ? [...new Set(errs)] : "none");
  console.log(" 4xx/5xx:", bad.length ? [...new Set(bad)].slice(0, 6) : "none");
  await page.close();
}

// mobile check on the map
const m = await ctx.newPage();
await m.setViewportSize({ width: 390, height: 844 });
await m.goto(B + "/map/", { waitUntil: "networkidle" });
await m.waitForTimeout(3000);
console.log("\n=== /map/ mobile 390px ===");
console.log(
  JSON.stringify(
    await m.evaluate(() => ({
      pane: !!document.querySelector(".leaflet-pane"),
      tiles: document.querySelectorAll(".leaflet-tile-loaded").length,
      mapRect: document.querySelector("#kolkata-map")?.getBoundingClientRect().toJSON(),
    }))
  )
);
await m.screenshot({ path: "/tmp/map-mobile.png" });
await browser.close();