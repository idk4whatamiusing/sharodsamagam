import { chromium } from "playwright";
import { rmSync } from "fs";
rmSync("/tmp/pw-err", { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext("/tmp/pw-err", {
  viewport: { width: 1200, height: 800 },
  serviceWorkers: "block",          // <-- the missing piece
});
const p = ctx.pages()[0] || (await ctx.newPage());
await p.route(/arcgisonline/, r => r.abort("blockedbyclient"));
await p.goto("https://meridian.dpdns.org/map/", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);

const r = await p.evaluate(() => {
  const n = document.querySelector("[data-map-error]");
  return {
    swCount: 0,
    noticeShown: !!n, role: n?.getAttribute("role"),
    heading: n?.querySelector("p")?.textContent,
    body: n?.querySelectorAll("p")[1]?.textContent?.slice(0, 80),
    hasRetry: !!n?.querySelector("button"),
    tilesLoaded: document.querySelectorAll(".leaflet-tile-loaded").length,
    tileErrors: document.querySelectorAll(".leaflet-tile-error").length,
    markers: document.querySelectorAll(".leaflet-overlay-pane path").length,
  };
});
console.log(JSON.stringify(r, null, 1));
await p.screenshot({ path: "/tmp/map-error.png" });

await p.unroute(/arcgisonline/);
await p.evaluate(() => document.querySelector("[data-map-error] button")?.click());
await p.waitForTimeout(9000);
console.log("after retry ->", JSON.stringify(await p.evaluate(() => ({
  noticeGone: !document.querySelector("[data-map-error]"),
  tiles: document.querySelectorAll(".leaflet-tile-loaded").length,
  markers: document.querySelectorAll(".leaflet-overlay-pane path").length,
}))));
await ctx.close();
