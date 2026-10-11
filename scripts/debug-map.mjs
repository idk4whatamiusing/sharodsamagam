// Debug harness: load a URL in Chromium and report console errors,
// page errors, failed requests, and a targeted DOM assertion.
import { chromium } from "playwright";

const url = process.argv[2] || "https://sharodsamagam.dsjzcjmsh6.workers.dev/map/";
const selector = process.argv[3] || "#kolkata-map";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
const failed = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) =>
  failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 140)}`)
);
page.on("response", (r) => {
  if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.url().slice(0, 140)}`);
});

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(4000);

const probe = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  const pane = document.querySelector(".leaflet-pane");
  const tiles = document.querySelectorAll(".leaflet-tile");
  const svg = document.querySelector(".leaflet-overlay-pane svg");
  const paths = svg ? svg.querySelectorAll("path").length : 0;
  const cs = el ? getComputedStyle(el) : null;
  return {
    containerFound: !!el,
    containerRect: el ? el.getBoundingClientRect().toJSON() : null,
    containerDisplay: cs?.display,
    containerHeight: cs?.height,
    leafletPane: !!pane,
    tileCount: tiles.length,
    loadedTiles: document.querySelectorAll(".leaflet-tile-loaded").length,
    markerPaths: paths,
    hasLeafletGlobal: typeof window.L !== "undefined",
  };
}, selector);

console.log("URL:", url);
console.log("PROBE:", JSON.stringify(probe, null, 2));
console.log("ERRORS:", errors.length ? errors : "none");
console.log("FAILED REQUESTS:", failed.length ? failed.slice(0, 12) : "none");

await page.screenshot({ path: "/tmp/map-debug.png", fullPage: false });
console.log("screenshot -> /tmp/map-debug.png");
await browser.close();