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

// ---------- paras directory ----------
console.log("\n== PARAS DIRECTORY ==");
{
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on("pageerror", e => errs.push(e.message.slice(0, 100)));
  p.on("console", c => (c.type() === "error" || c.type() === "warning") && errs.push(c.text().slice(0, 100)));
  await ready(p, B + "/paras/");

  const CARD = 'a.block.h-full[href^="/paras/"]';

  // The listing used to render its 24 cards twice, stacked, at every
  // breakpoint - so the header count is pinned as a regression guard.
  const initial = await p.evaluate((sel) => ({
    cards: document.querySelectorAll(sel).length,
    h1: document.querySelectorAll("h1").length,
    count: document.querySelector("[data-paras-count]")?.textContent || "",
  }), CARD);
  ok(initial.h1 === 1, `single heading, no duplicated listing (h1=${initial.h1})`);
  ok(initial.cards === 24, `starts with the server-rendered page (${initial.cards})`);
  ok(/Showing 24 of 776/.test(initial.count), `count states the real size (${initial.count})`);

  // Scroll the sentinel until it reports exhaustion.
  for (let i = 0; i < 60; i++) {
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(220);
    const done = await p.evaluate(() => {
      const s = document.querySelector("[data-paras-sentinel]");
      return !s || s.style.display === "none";
    });
    if (done) break;
  }

  const loaded = await p.evaluate(async (sel) => {
    const cards = [...document.querySelectorAll(sel)];
    const hrefs = new Set(cards.map((a) => a.getAttribute("href")));
    const data = await (await fetch("/paras.json")).json();
    return {
      dom: cards.length,
      distinct: hrefs.size,
      expected: data.length,
      missing: data.filter((x) => !hrefs.has("/paras/" + x.slug)).length,
      count: document.querySelector("[data-paras-count]")?.textContent || "",
    };
  }, CARD);
  ok(loaded.dom === loaded.expected, `all ${loaded.expected} cards load (${loaded.dom})`);
  ok(loaded.distinct === loaded.expected, `no duplicate cards (${loaded.distinct} distinct)`);
  ok(loaded.missing === 0, `every pandal present (${loaded.missing} missing)`);
  ok(/Showing all 776/.test(loaded.count), `count reaches the end (${loaded.count})`);

  const visible = () =>
    p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((a) => a.style.display !== "none").length, CARD);
  const clickChip = async (label) => {
    await p.evaluate((l) => {
      const btn = [...document.querySelectorAll("main button")].find(
        (x) => x.innerText.trim().toLowerCase().replace(/\d+\s*$/, "").trim() === l
      );
      btn?.click();
    }, label);
    await p.waitForTimeout(320);
  };

  // Zone totals must equal the dataset, not just the first 24.
  const expectedZones = await p.evaluate(async () => {
    const d = await (await fetch("/paras.json")).json();
    const c = {};
    d.forEach((x) => (c[x.zone] = (c[x.zone] || 0) + 1));
    return c;
  });
  for (const [zone, n] of Object.entries(expectedZones)) {
    await clickChip(zone);
    const got = await visible();
    ok(got === n, `zone ${zone}: ${got}/${n}`);
  }
  await clickChip("all");
  ok((await visible()) === loaded.expected, "All restores every card");

  // These two used to be tested as zone names, matched nothing, and blanked
  // the entire grid.
  await clickChip("featured");
  const feat = await visible();
  ok(feat > 0 && feat < loaded.expected, `Featured filters instead of blanking (${feat})`);
  await clickChip("saved");
  ok((await visible()) === 0, "Saved with nothing saved shows none, without hiding the grid");
  await clickChip("all");

  // Search must reach beyond the server-rendered 24.
  const midName = await p.evaluate(async () => (await (await fetch("/paras.json")).json())[400].name);
  await p.evaluate((t) => {
    const i = document.querySelector('input[placeholder*="Search pandal"]');
    i.value = t;
    i.dispatchEvent(new Event("input", { bubbles: true }));
  }, midName);
  await p.waitForTimeout(500);
  ok((await visible()) === 1, `search reaches a pandal outside the first 24 (${midName.slice(0, 30)})`);

  // Saved must survive a reload.
  await p.evaluate(() => {
    const i = document.querySelector('input[placeholder*="Search pandal"]');
    i.value = "";
    i.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    document.querySelector('a.block.h-full[href^="/paras/"] [aria-label="Save Pandal"]').click();
  });
  await p.waitForTimeout(300);
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(1200);
  const badge = await p.evaluate(() => {
    const btn = [...document.querySelectorAll("main button")].find((x) =>
      x.innerText.trim().toLowerCase().startsWith("saved")
    );
    return btn ? btn.innerText.replace(/\s+/g, " ") : "";
  });
  ok(/Saved\s*1/.test(badge), `Saved persists across reload (${badge})`);

  ok(errs.length === 0, "paras console clean" + (errs.length ? ": " + [...new Set(errs)].join(" | ") : ""));
  await p.close();
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

// ---------- metro map ----------
console.log("\n== METRO MAP ==");
{
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const xerrs = [];
  p.on("pageerror", (e) => xerrs.push(e.message.slice(0, 100)));
  p.on("console", (c) => c.type() === "error" && xerrs.push(c.text().slice(0, 100)));
  await ready(p, B + "/guide/");

  // The skeleton is what the mirror holds; the map replaces it at build time.
  const skeleton = await p.evaluate(() =>
    /Loading Kolkata Transit/.test(document.body.innerText)
  );
  ok(!skeleton, "loading skeleton is gone");

  // Tiles come from OSM, so wait for real pixels rather than for the element.
  let tiles = { loaded: 0, total: 0 };
  try {
    await p.waitForFunction(
      () => {
        const t = [...document.querySelectorAll("[data-metro-map] .leaflet-tile")];
        return t.length > 0 && t.every((x) => x.complete);
      },
      null,
      { timeout: 25000 }
    );
  } catch {
    /* measured below either way */
  }
  await p.waitForTimeout(1200);

  const map = await p.evaluate(() => {
    const host = document.querySelector("[data-metro-map]");
    if (!host) return { missing: true };
    const box = host.getBoundingClientRect();
    const t = [...host.querySelectorAll(".leaflet-tile")];
    const attr = host.querySelector(".leaflet-control-attribution");
    const ab = attr?.getBoundingClientRect();
    const pins = [...host.querySelectorAll(".leaflet-marker-icon span")].map(
      (s) => s.style.background
    );
    const colours = {};
    for (const c of pins) colours[c] = (colours[c] || 0) + 1;
    const legend = host.querySelector("[data-metro-legend]");
    const lb = legend?.getBoundingClientRect();
    return {
      height: Math.round(box.height),
      tilesLoaded: t.filter((x) => x.complete && x.naturalWidth > 0).length,
      tilesTotal: t.length,
      strokes: [...host.querySelectorAll(".leaflet-overlay-pane path")].map((x) =>
        x.getAttribute("stroke")
      ),
      metroPins: pins.length - (colours["rgb(28, 25, 23)"] || 0),
      railPins: colours["rgb(28, 25, 23)"] || 0,
      pinColours: Object.keys(colours).length,
      legendText: (legend?.innerText || "").replace(/\s+/g, " ").trim(),
      legendInside: !!lb && lb.left >= box.left - 1 && lb.right <= box.right + 1,
      attributionVisible:
        !!attr && getComputedStyle(attr).display !== "none" && (ab?.width || 0) > 0,
      attributionInside: !!ab && ab.right <= box.right + 1 && ab.bottom <= box.bottom + 1,
    };
  });

  if (map.missing) {
    ok(false, "map slot exists on /guide/");
  } else {
    // Guards the cascade regression: the original's theme sets
    // .leaflet-container{height:100%}, which collapsed the slot to 4px.
    ok(map.height >= 400, `map has its reserved height (${map.height}px)`);
    ok(
      map.tilesLoaded > 0 && map.tilesLoaded === map.tilesTotal,
      `OpenStreetMap tiles load (${map.tilesLoaded}/${map.tilesTotal})`
    );
    const want = ["#2563EB", "#16A34A", "#9333EA", "#CA8A04", "#EA580C"];
    ok(
      map.strokes.length === 5 && want.every((c) => map.strokes.includes(c)),
      `five metro lines drawn (${map.strokes.join(" ")})`
    );
    ok(map.metroPins === 58, `58 metro stations pinned (${map.metroPins})`);
    ok(map.railPins === 9, `9 suburban railway terminals pinned (${map.railPins})`);
    ok(map.pinColours >= 6, `pins are coloured by line (${map.pinColours} colours)`);
    // The corridor cards' own counts: 26/12/7/4/9, and they only add up to 58
    // once the interchange duplicates the original draws are collapsed.
    ok(
      /Blue Line 26[\s\S]*Green Line 12[\s\S]*Purple Line 7[\s\S]*Yellow Line 4[\s\S]*Orange Line 9/.test(
        map.legendText
      ),
      "legend carries the corridor cards' per-line counts"
    );
    ok(
      /58 metro stations/.test(map.legendText) && /9 railway terminals/.test(map.legendText),
      "legend separates metro stations from railway terminals"
    );
    ok(map.legendInside, "legend sits inside the map frame");
    // OSM's tile policy requires the credit to be visible; the original's
    // theme hides it with !important.
    ok(map.attributionVisible, "OpenStreetMap attribution is visible");
    ok(map.attributionInside, "attribution sits inside the map frame");

    // A station popup is the map's actual content, not decoration.
    await p.evaluate(() => {
      const first = document.querySelector(
        "[data-metro-map] .leaflet-marker-icon span"
      );
      first?.parentElement?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
      );
    });
    await p.waitForTimeout(700);
    const popup = await p.evaluate(
      () =>
        document.querySelector("[data-metro-map] .leaflet-popup-content")?.innerText.replace(/\s+/g, " ").trim() ||
        ""
    );
    ok(
      /[ঀ-৿]/.test(popup) && /Line/.test(popup),
      `station popup names the place and its line (${popup.slice(0, 48)})`
    );
  }
  ok(xerrs.length === 0, "guide console clean" + (xerrs.length ? ": " + [...new Set(xerrs)].join(" | ") : ""));

  // The same map is advertised on the second guide page.
  await ready(p, B + "/guide/navigating-kolkata/");
  let second = { strokes: 0, pins: 0, skeleton: true };
  try {
    await p.waitForFunction(
      () => document.querySelectorAll("[data-metro-map] .leaflet-marker-icon").length > 60,
      null,
      { timeout: 25000 }
    );
  } catch {
    /* measured below either way */
  }
  second = await p.evaluate(() => ({
    strokes: document.querySelectorAll("[data-metro-map] .leaflet-overlay-pane path").length,
    pins: document.querySelectorAll("[data-metro-map] .leaflet-marker-icon").length,
    skeleton: /Loading Kolkata Transit/.test(document.body.innerText),
  }));
  ok(
    second.strokes === 5 && second.pins === 67 && !second.skeleton,
    `navigating-kolkata draws the same network (${second.strokes} lines, ${second.pins} pins)`
  );
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
