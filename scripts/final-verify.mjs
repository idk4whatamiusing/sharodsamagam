import { chromium } from "playwright";
import { existsSync } from "node:fs";
const B = process.env.BASE || "http://127.0.0.1:8899";
// dpdns.org carries the delegation for its subdomains on only ONE of the four
// parent nameservers (ns1). ns2/ns3/ns4 answer NOERROR-with-no-records, so
// resolvers landing on one of those cache a negative result and the host
// intermittently fails to resolve. Pin it to a known-good address so these
// checks measure the site rather than DigitalPlat's DNS.
let launchArgs = [];
if (process.env.PIN_DNS) {
  const { resolve4 } = await import("node:dns").then((m) => m.promises);
  const ip = (await resolve4(process.env.PIN_DNS))[0];
  if (!ip) throw new Error(`could not resolve ${process.env.PIN_DNS} to pin`);
  console.log(`pinning ${process.env.PIN_DNS} -> ${ip}`);
  launchArgs = [`--host-resolver-rules=MAP ${process.env.PIN_DNS} ${ip}`];
}
// Prefer the locally installed Brave so we exercise the browser the user
// actually uses, but fall back to Playwright's bundled Chromium - which is
// what CI installs, and what exists on any machine without Brave.
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const b = await chromium.launch({
  ...(existsSync(BRAVE) ? { executablePath: BRAVE } : {}),
  headless: true,
  args: launchArgs,
});
let fail = 0;
const ok = (c, m) => { console.log((c ? "  PASS " : "  FAIL ") + m); if (!c) fail++; };

// "networkidle" never settles once the service worker keeps tile connections
// warm, but "domcontentloaded" returns before React has hydrated - which
// makes every assertion race hydration. Wait for a real hydration sentinel
// instead: the audio player lives in the layout and portals its buttons into
// the navbar on mount, so those buttons existing means the tree is live.
async function ready(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(
    () => !!document.querySelector("#mobile-nav-actions button"),
    null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(700); // let pathname-driven effects settle
}

// ---------- mobile ----------
const m = await b.newPage({ viewport: { width: 390, height: 844 } });
const merr = [];
m.on("pageerror", e => merr.push(e.message.slice(0,120)));
m.on("console", c => c.type()==="error" && merr.push(c.text().slice(0,120)));
await ready(m, B + "/");

console.log("\n== COUNTDOWN ==");
const cd1 = await m.evaluate(() => document.querySelector("[data-countdown-slot]")?.innerText || "");
// Maha Shashthi is a fixed date (16 Oct 2026). Once it passes the widget is
// supposed to settle into its terminal "is live" state, so the assertions
// have to branch rather than assume a ticking clock forever.
const isLive = /is live/i.test(cd1);
if (isLive) {
  ok(true, "countdown is in its post-festival state: " + cd1.replace(/\n/g, " ").slice(0, 46));
  const cd1b = await m.evaluate(() => document.querySelector("[data-countdown-slot]")?.innerText || "");
  await m.waitForTimeout(2200);
  const cd2 = await m.evaluate(() => document.querySelector("[data-countdown-slot]")?.innerText || "");
  ok(cd1b === cd2 && cd1 === cd2, "post-festival state is stable (not ticking)");
} else {
  await m.waitForTimeout(2200);
  const cd2 = await m.evaluate(() => document.querySelector("[data-countdown-slot]")?.innerText || "");
  ok(/\d/.test(cd1), "countdown renders digits: " + cd1.replace(/\n/g, " "));
  ok(cd1 !== cd2, "countdown is ticking");
  ok(/Maha Shashthi/.test(cd1), "countdown names its target");
}

console.log("\n== DAY SWITCH (all 6) ==");
// Maha Saptami occupies two days on the original and is split into two tabs
// here, so both saptami1 and saptami2 legitimately carry the same title.
for (const [key, title] of [["shashthi","Maha Shashthi"],["saptami1","Maha Saptami"],["saptami2","Maha Saptami"],["ashtami","Maha Ashtami"],["nabami","Maha Nabami"],["dashami","Vijaya Dashami"]]) {
  const r = await m.evaluate(async (k) => {
    document.querySelector(`[data-fday="${k}"]`)?.click();
    await new Promise(r => setTimeout(r, 250));
    const panel = document.querySelector("[data-fday-panel]");
    const rows = [...panel.querySelectorAll(".grid > div")];
    let overlap = false;
    for (const row of rows) {
      const l = row.querySelector("span").getBoundingClientRect();
      const t = row.querySelector("p").getBoundingClientRect();
      if (t.left < l.right - 0.5) overlap = true;
    }
    const tabs = [...document.querySelectorAll("[data-fday]")];
    const act = tabs.find(t => t.getAttribute("aria-selected") === "true");
    return { title: panel.querySelector("h3")?.textContent, rows: rows.length, overlap,
             active: act?.dataset.fday, arrow: !!act?.querySelector(":scope > div"),
             pillLines: Math.round((panel.querySelector("span.rounded-full")?.getBoundingClientRect().height || 0)) };
  }, key);
  ok(r.title === title, `${key}: panel="${r.title}" rows=${r.rows}`);
  ok(!r.overlap, `${key}: no label/time overlap`);
  ok(r.active === key, `${key}: active tab + arrow (${r.active}, arrow=${r.arrow})`);
  ok(r.pillLines < 24, `${key}: tithi pill single line (${r.pillLines}px)`);
}

console.log("\n== HERO CARD ==");
{
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await ready(p, B + "/");

  const card = await p.evaluate(() => {
    const strip = document.querySelector("[data-zone-breakdown]");
    const tiles = strip ? [...strip.querySelectorAll("a")] : [];
    const nums = tiles.map((a) => Number(a.querySelector("span").textContent));
    const statCard = strip ? strip.closest("div.space-y-2\\.5") : null;
    return {
      tiles: tiles.length,
      sum: nums.reduce((a, b) => a + b, 0),
      labels: tiles.map((a) => a.querySelectorAll("span")[1].textContent.trim()),
      allLinked: tiles.every((a) => (a.getAttribute("href") || "").startsWith("/paras")),
      arrows: document.querySelectorAll('[aria-label="Previous slide"],[aria-label="Next slide"]').length,
      skeletons: statCard ? statCard.querySelectorAll(".animate-pulse.rounded").length : -1,
      stats: statCard
        ? [...statCard.querySelectorAll(".group\\/stat p")].map((x) => x.textContent.trim())
        : [],
      caption: (() => {
        const el = [...document.querySelectorAll("p")].find(
          (n) => /Sharodsamagam 2026 · Kolkata/.test(n.textContent)
        );
        return el ? el.textContent.trim() : null;
      })(),
      brand: document.body.innerText.includes("Sharodotsav"),
    };
  });
  ok(card.tiles === 6, `zone breakdown lists six zones (${card.tiles})`);
  ok(card.sum === 776, `zone counts total the dataset (${card.sum})`);
  ok(card.allLinked, "every zone tile links to the directory");
  ok(card.arrows === 0, "dead carousel arrows removed");
  ok(card.skeletons === 0, "loading skeletons resolved");
  ok(card.caption === "Sharodsamagam 2026 · Kolkata", `caption branded (${card.caption})`);
  ok(!card.brand, "no 'Sharodotsav' left on the page");
  ok(card.stats[0] === "776" && card.stats[2] === "6", `stats match data (${card.stats.join("/")})`);

  // The phase pill must name the day the shared dataset says, not a
  // hand-maintained list that drifts when days are split.
  const pill = await p.evaluate(() => document.querySelector("[data-mahalaya-status]")?.textContent || "");
  const expected = (() => {
    const d = new Date();
    const days = [
      ["2026-10-16", "Maha Shashthi"], ["2026-10-17", "Maha Saptami"],
      ["2026-10-18", "Maha Saptami"], ["2026-10-19", "Maha Ashtami"],
      ["2026-10-20", "Maha Nabami"], ["2026-10-21", "Vijaya Dashami"],
    ];
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hit = days.find(([iso2]) => iso2 === iso);
    return hit ? `Day ${days.findIndex(([x]) => x === iso) + 1} of 6 · ${hit[1]}` : null;
  })();
  ok(
    expected === null || pill === expected,
    `phase pill matches the calendar (got "${pill}", want "${expected}")`
  );
  await p.close();
}

console.log("\n== NAVBAR BUTTONS ==");
ok(await m.evaluate(() => !!document.getElementById("mobile-nav-actions")), "slot present");
ok(await m.evaluate(() => document.querySelectorAll("#mobile-nav-actions button").length) === 2, "2 buttons in slot");
ok(await m.evaluate(() => {
  const b = document.querySelector('#mobile-nav-actions button[aria-label="Playlist"]');
  return b.getBoundingClientRect().width > 0;
}), "visible at 390px");
for (const w of [320, 768, 1024, 1440]) {
  await m.setViewportSize({ width: w, height: 844 });
  await m.waitForTimeout(350);
  const r = await m.evaluate(() => ({
    nav: [...document.querySelectorAll("#mobile-nav-actions button")].filter(x => x.getBoundingClientRect().width > 0).length,
    ovf: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  const expect = w < 1024 ? 2 : 0;
  ok(r.nav === expect && !r.ovf, `${w}px: navButtons=${r.nav} (want ${expect}), noOverflow=${!r.ovf}`);
}
await m.setViewportSize({ width: 390, height: 844 });
await m.waitForTimeout(300);
await m.evaluate(() => document.querySelector('#mobile-nav-actions button[aria-label="Dhak"]').click());
await m.waitForTimeout(400);
const sync = await (async () => {
  const on = await m.evaluate(() => document.querySelector('#mobile-nav-actions button[aria-label="Dhak"]').getAttribute("aria-pressed"));
  await m.setViewportSize({ width: 1440, height: 844 });
  await m.waitForTimeout(400);
  const cls = await m.evaluate(() => [...document.querySelectorAll('button[aria-label="Dhak"]')].find(x => x.getBoundingClientRect().width > 0)?.className);
  return on === "true" && cls.includes("bg-[#D90429]");
})();
ok(sync, "dhak state synced mobile -> desktop");
ok(merr.length === 0, "mobile console clean" + (merr.length ? ": " + merr.join(" | ") : ""));

// ---------- client-side navigation ----------
// The layout persists across router.push navigation while page children swap
// underneath it. Any page-scoped component whose effect has a [] dependency
// array runs exactly once and is dead for the rest of the session. Full page
// loads hide this completely, so it must be exercised explicitly.
console.log("\n== CLIENT-SIDE NAVIGATION ==");
{
  const nav = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const nerr = [];
  nav.on("pageerror", (e) => nerr.push(e.message.slice(0, 100)));
  nav.on("console", (c) => c.type() === "error" && nerr.push(c.text().slice(0, 100)));

  await ready(nav, B + "/");
  ok(await nav.evaluate(() => /\d/.test(document.querySelector("[data-countdown-slot]")?.innerText || "")), "home on load: countdown live");

  // home -> /map via the navbar link
  await nav.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find((x) => x.getAttribute("href") === "/map");
    a ? a.click() : (window.__noMapLink = true);
  });
  await nav.waitForTimeout(4500);
  ok(!(await nav.evaluate(() => !!window.__noMapLink)), "nav link /map present");
  ok(await nav.evaluate(() => location.pathname.startsWith("/map")), "client-navigated to /map/");
  // Wait for the map rather than sleeping: the effect re-runs on route change
  // and then has to dynamically import Leaflet and fetch points.json.
  const mapUp = await nav
    .waitForFunction(() => !!document.querySelector(".leaflet-pane"), null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  ok(mapUp, "leaflet pane attached after client nav");
  await nav.waitForTimeout(2500);
  const m1 = await nav.evaluate(() => ({
    div: !!document.getElementById("kolkata-map"),
    pane: !!document.querySelector(".leaflet-pane"),
    tiles: document.querySelectorAll(".leaflet-tile-loaded").length,
    markers: document.querySelectorAll(".leaflet-overlay-pane path").length,
  }));
  ok(m1.div && m1.pane && m1.tiles > 0 && m1.markers > 100, `map rendered after client nav (tiles=${m1.tiles}, markers=${m1.markers})`);

  // Every geocoded pandal must actually be on the map.
  const expected = Number(process.env.EXPECTED_MARKERS || 0);
  if (expected) ok(m1.markers === expected, `all geocoded markers drawn (${m1.markers} of ${expected})`);

  // /map -> home again
  await nav.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find((x) => x.getAttribute("href") === "/");
    a ? a.click() : (window.__noHomeLink = true);
  });
  await nav.waitForTimeout(3000);
  const h = await nav.evaluate(() => {
    const s = document.querySelector("[data-countdown-slot]");
    const tabs = [...document.querySelectorAll("[data-fday]")];
    return { digits: /\d/.test(s?.innerText || ""), tabs: tabs.length };
  });
  ok(h.digits, "countdown re-armed after navigating back");
  ok(h.tabs === 6, `day tabs present after navigating back (${h.tabs})`);
  await nav.evaluate(() => document.querySelector('[data-fday="dashami"]')?.click());
  await nav.waitForTimeout(500);
  ok(
    await nav.evaluate(() => document.querySelector("[data-fday-panel] h3")?.textContent === "Vijaya Dashami"),
    "day switch still works after navigating back"
  );

  // home -> /paras/<slug> mini-map, then away
  await nav.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find((x) => (x.getAttribute("href") || "").startsWith("/paras/") && x.getAttribute("href") !== "/paras/");
    a ? a.click() : (window.__noPandal = true);
  });
  await nav.waitForTimeout(4000);
  const miniUp = await nav
    .waitForFunction(() => !!document.querySelector("#pandal-map .leaflet-pane"), null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  ok(miniUp, "pandal mini-map pane attached after client nav");
  await nav.waitForTimeout(1500);
  const pm = await nav.evaluate(() => ({
    div: !!document.getElementById("pandal-map"),
    pane: !!document.querySelector(".leaflet-pane"),
    marker: document.querySelectorAll(".leaflet-marker-icon").length,
  }));
  ok(pm.div && pm.pane && pm.marker > 0, `pandal mini-map rendered after client nav (marker=${pm.marker})`);
  ok(nerr.length === 0, "client-nav console clean" + (nerr.length ? ": " + [...new Set(nerr)].join(" | ") : ""));
  await nav.close();
}

// ---------- panzika ----------
console.log("\n== PANZIKA ==");
{
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const perrs = [];
  p.on("pageerror", e => perrs.push(e.message.slice(0, 100)));
  p.on("console", c => c.type() === "error" && perrs.push(c.text().slice(0, 100)));
  await ready(p, B + "/panzika/");

  const shape = await p.evaluate(() => ({
    days: document.querySelectorAll("[data-pday]").length,
    gridDays: document.querySelectorAll("[data-gridday]").length,
    // Only the seven festival dates should be clickable in the month grid.
    clickable: document.querySelectorAll("[data-gridday]:not([disabled])").length,
    views: [...document.querySelectorAll('[role="tab"]')]
      .filter((t) => /Calendar|Almanac/.test(t.textContent)).length,
    print: !!document.querySelector("button"),
  }));
  ok(shape.days === 7, `seven day tabs (${shape.days})`);
  ok(shape.gridDays === 31, `October grid renders every date (${shape.gridDays})`);
  ok(shape.clickable === 7, `only festival dates are selectable (${shape.clickable})`);
  ok(shape.views === 2, `calendar and almanac views present (${shape.views})`);

  // Every day must render a populated panel, and the ritual table must not
  // come back empty - the harvested data is the only source for these.
  let allDays = true;
  for (const k of ["mahalaya","shashthi","saptami1","saptami2","ashtami","nabami","dashami"]) {
    await p.click(`[data-pday="${k}"]`);
    await p.waitForTimeout(200);
    const r = await p.evaluate((kk) => {
      const sec = document.querySelector('[aria-live="polite"]');
      const rows = sec ? [...sec.querySelectorAll("h3 + div > div")] : [];
      return {
        heading: sec?.querySelector("h2")?.innerText.replace(/\s+/g, " ").trim() || "",
        narrative: (sec?.querySelector("p.font-serif")?.innerText || "").trim().length,
        rows: rows.length,
        blanks: rows.filter((x) => !x.innerText.trim()).length,
        selected: document.querySelector(`[data-pday="${kk}"]`)?.getAttribute("aria-selected"),
      };
    }, k);
    if (!r.heading || !r.narrative || !r.rows || r.blanks || r.selected !== "true") {
      allDays = false;
      console.log(`       ${k}: "${r.heading}" narrative=${r.narrative} rows=${r.rows} blanks=${r.blanks} sel=${r.selected}`);
    }
  }
  ok(allDays, "every day renders a heading, narrative and non-empty ritual rows");

  // Clicking a calendar cell must drive the same panel as the tab strip.
  await p.click('[data-gridday="21"]');
  await p.waitForTimeout(250);
  const viaGrid = await p.evaluate(() => ({
    heading: document.querySelector('[aria-live="polite"] h2')?.innerText.replace(/\s+/g, " ").trim(),
    pressed: document.querySelector('[data-gridday="21"]')?.getAttribute("aria-pressed"),
  }));
  ok(viaGrid.heading.includes("দশমী"), `calendar cell selects its day (${viaGrid.heading})`);
  ok(viaGrid.pressed === "true", "selected cell marked aria-pressed");

  // The almanac is a second view with its own content.
  await p.click('button:has-text("Traditional Almanac Table")');
  await p.waitForTimeout(300);
  const alm = await p.evaluate(() => ({
    entries: document.querySelectorAll("article").length,
    bengali: /কার্তিক|আশ্বিন/.test(document.body.innerText),
  }));
  ok(alm.entries === 7, `almanac lists all seven entries (${alm.entries})`);
  ok(alm.bengali, "almanac carries the Bengali month names");
  ok(perrs.length === 0, "panzika console clean" + (perrs.length ? ": " + [...new Set(perrs)].join(" | ") : ""));
  await p.close();
}

// ---------- other pages ----------
console.log("\n== REGRESSION ==");
for (const [name, url] of [["/", "/"], ["/paras/", "/paras/"], ["/map/", "/map/"], ["/panzika/", "/panzika/"]]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on("pageerror", e => errs.push(e.message.slice(0,100)));
  p.on("console", c => c.type()==="error" && errs.push(c.text().slice(0,100)));
  // "networkidle" is unreliable here: the service worker keeps tile
  // connections warm, so the page can never settle within the timeout.
  await ready(p, B + url);
  ok(errs.length === 0, `${name} console clean` + (errs.length ? ": " + [...new Set(errs)].join(" | ") : ""));
  await p.close();
}
console.log(fail === 0 ? "\nALL CHECKS PASSED" : `\n${fail} CHECK(S) FAILED`);
await b.close();
process.exit(fail === 0 ? 0 : 1);
