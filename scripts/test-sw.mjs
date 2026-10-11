import { chromium } from "playwright";
import { rmSync } from "fs";

const PROFILE = "/tmp/pw-profile";
rmSync(PROFILE, { recursive: true, force: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
  viewport: { width: 1440, height: 1000 },
});
const B = "https://sharodsamagam.dsjzcjmsh6.workers.dev";

async function report(label) {
  const page = ctx.pages()[0] || (await ctx.newPage());
  const errs = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 120)));
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 120)));
  await page.goto(B + "/map/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  const info = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    const keys = await caches.keys();
    return {
      swControllers: regs.length,
      swScope: regs[0]?.scope,
      swActive: !!regs[0]?.active,
      caches: keys,
      mapDiv: !!document.getElementById("kolkata-map"),
      leafletPane: !!document.querySelector(".leaflet-pane"),
      tiles: document.querySelectorAll(".leaflet-tile-loaded").length,
      markers: document.querySelectorAll(".leaflet-overlay-pane path").length,
      leafletCssLoaded:
        !!document.querySelector(".leaflet-container") &&
        getComputedStyle(document.querySelector(".leaflet-container")).position === "relative",
      cssLinks: [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href.split("/").pop()),
    };
  });
  console.log(`\n--- ${label} ---`);
  console.log(JSON.stringify(info, null, 2));
  console.log("errors:", errs.length ? [...new Set(errs)] : "none");
  await page.screenshot({ path: `/tmp/sw-${label.replace(/\W/g, "_")}.png` });
}

await report("visit-1");
await report("visit-2");
await ctx.close();
