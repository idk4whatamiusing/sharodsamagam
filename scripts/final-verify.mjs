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

  // The hero advertised a seven-slide carousel, but the scrape only ever
  // captured two slides: five panels per variant hold no image at all. Both
  // dot rows must be trimmed to the slides that exist, and drive them.
  const heroDots = await p.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-hero-dots]")];
    const panels = [...document.querySelectorAll("[data-hero-slide]")];
    return {
      rows: rows.length,
      counts: rows.map((row) => row.querySelectorAll("button").length),
      labels: rows.map((row) =>
        [...row.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") || "")
      ),
      lit: panels.filter((el) => el.classList.contains("opacity-100")).map((el) => el.dataset.heroSlide),
    };
  });
  ok(heroDots.rows === 2, `both hero dot rows tagged (${heroDots.rows})`);
  ok(
    heroDots.counts.every((n) => n === 2),
    `dot rows trimmed to the two captured slides (rows: ${heroDots.counts.join("/")} dots)`
  );
  ok(
    /^Jump to 01 · /.test(heroDots.labels[0]?.[0] || "") &&
      /^Jump to 02 · /.test(heroDots.labels[0]?.[1] || "") &&
      heroDots.labels[1]?.[0] === "Go to slide 1" &&
      heroDots.labels[1]?.[1] === "Go to slide 2",
    `the kept dots name slides 01-02 (${heroDots.labels.flat().join(" | ")})`
  );
  ok(
    heroDots.lit.length === 2 && heroDots.lit.every((i) => i === "0"),
    `slide one is the lit backdrop on load (${heroDots.lit.join(",")})`
  );

  await p.evaluate(() => document.querySelector("[data-hero-dots] button:last-child")?.click());
  const switched = await p.evaluate(() => {
    const panels = [...document.querySelectorAll("[data-hero-slide]")];
    const rows = [...document.querySelectorAll("[data-hero-dots]")];
    const byState = (cls) =>
      panels.filter((el) => el.classList.contains(cls)).map((el) => Number(el.dataset.heroSlide));
    return {
      pairs: panels.length,
      lit: byState("opacity-100"),
      dim: byState("opacity-0"),
      current: rows.map((row) =>
        [...row.querySelectorAll("button")].findIndex((b) => b.getAttribute("aria-current") === "true")
      ),
    };
  });
  ok(
    switched.pairs === 4 &&
      switched.lit.length === 2 &&
      switched.lit.every((i) => i === 1) &&
      switched.dim.length === 2 &&
      switched.dim.every((i) => i === 0),
    `second dot switches both variants to slide two (lit ${switched.lit.join(",")} / dim ${switched.dim.join(",")})`
  );
  ok(
    switched.current.length === 2 && switched.current.every((i) => i === 1),
    `both rows follow the switch (active index ${switched.current.join("/")})`
  );

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

console.log("\n== MOBILE FOOTER ACCORDION ==");
{
  // The footer's four section headers shipped from the scrape with no panels
  // behind them: pressing one flipped aria-expanded and revealed nothing, and
  // because the toggle looked at the wrapper's next sibling, pressing it
  // twice hid the *next* section. The panels are harvested from the original
  // by scripts/harvest-mobile-sheet.mjs and grafted in at build time.
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
  p.on("console", (c) => c.type() === "error" && errs.push(c.text().slice(0, 100)));
  await ready(p, B + "/");

  const TITLES = [
    "Pandal Circuits & Zones",
    "Smart Travel & City Guide",
    "Culture, Lore & Media",
    "About & Assistance",
  ];
  const problems = [];
  for (const title of TITLES) {
    const r = await p.evaluate(async (t) => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        (b.textContent || "").replace(/\s+/g, " ").includes(t)
      );
      if (!button) return { error: "header not found" };
      const panel = button.nextElementSibling;
      const nextSection = button.parentElement?.nextElementSibling;
      const rest = { display: panel ? getComputedStyle(panel).display : null };
      button.click();
      await new Promise((r) => setTimeout(r, 250));
      const open = {
        expanded: button.getAttribute("aria-expanded"),
        display: panel ? getComputedStyle(panel).display : null,
        visible: panel
          ? [...panel.querySelectorAll("a[href]")].filter((a) => a.getClientRects().length).length
          : 0,
        hrefs: panel ? [...panel.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")) : [],
        nextSectionDisplay: nextSection ? getComputedStyle(nextSection).display : null,
      };
      button.click();
      await new Promise((r) => setTimeout(r, 250));
      const closed = {
        expanded: button.getAttribute("aria-expanded"),
        display: panel ? getComputedStyle(panel).display : null,
      };
      return { rest, open, closed };
    }, title);

    if (r.error) {
      problems.push(`${title}: ${r.error}`);
      continue;
    }
    const bad = [];
    if (r.rest.display !== "none") bad.push("panel not hidden at rest");
    if (r.open.expanded !== "true") bad.push("aria-expanded not set");
    if (r.open.display === "none" || r.open.visible < 3) bad.push(`reveals ${r.open.visible} items`);
    if (r.open.nextSectionDisplay === "none") bad.push("hid the next section");
    if (r.closed.expanded !== "false" || r.closed.display !== "none") bad.push("does not close");
    if (r.open.hrefs.some((h) => /admin|login/i.test(h || ""))) bad.push("carries an admin link");
    if (bad.length) problems.push(`${title}: ${bad.join(", ")}`);
  }
  ok(
    problems.length === 0,
    "all four footer panels expand, reveal their links and close again" +
      (problems.length ? ": " + problems.join(" | ") : "")
  );

  const hrefs = await p.evaluate(() =>
    [
      ...new Set(
        [...document.querySelectorAll("[data-sheet-panel] a[href]")].map((a) => a.getAttribute("href"))
      ),
    ]
  );
  const missing = [];
  for (const h of hrefs) {
    const res = await p.request.get(B + h);
    if (res.status() !== 200) missing.push(`${h} (${res.status()})`);
  }
  ok(
    hrefs.length >= 15 && missing.length === 0,
    `every footer-panel link answers (${hrefs.length} links)` +
      (missing.length ? ": " + missing.join(", ") : "")
  );
  ok(errs.length === 0, "accordion console clean" + (errs.length ? ": " + [...new Set(errs)].join(" | ") : ""));
  await p.close();
}

console.log("\n== MOBILE MORE + TEEN CHALA ==");
{
  // The phone bottom bar's More was dead. The only trigger the layout wired
  // was the first button matching "more" in document order, which is the
  // desktop header's button - hidden below lg - so the visible phone button
  // opened nothing. Both triggers open the same panel now, which scrolls,
  // and closes on an outside tap or Escape.
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
  p.on("console", (c) => c.type() === "error" && errs.push(c.text().slice(0, 100)));
  await ready(p, B + "/");

  const more = await p.evaluate(async () => {
    const vis = [...document.querySelectorAll("button")].filter(
      (b) => /^more$/i.test((b.textContent || "").trim()) && b.getClientRects().length
    );
    const out = { visible: vis.length };
    vis[0]?.click();
    await new Promise((r) => setTimeout(r, 300));
    const panel = document.getElementById("our-more-panel");
    const rect = panel?.getBoundingClientRect();
    out.display = panel ? getComputedStyle(panel).display : null;
    out.inViewport = rect
      ? rect.x >= -1 && rect.y >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1
      : false;
    out.links = panel ? panel.querySelectorAll("a[href^='/']").length : 0;
    out.overflowY = panel ? getComputedStyle(panel).overflowY : null;
    document.body.click();
    await new Promise((r) => setTimeout(r, 250));
    out.afterOutside = panel?.style.display;
    out.triggerClean = vis[0] ? vis[0].style.background === "" : null;
    vis[0]?.click();
    await new Promise((r) => setTimeout(r, 250));
    out.reopened = panel?.style.display;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    out.afterEscape = panel?.style.display;
    return out;
  });
  ok(more.visible >= 1, `the phone bottom bar has a visible More (${more.visible})`);
  ok(
    more.display === "block" && more.inViewport && more.links >= 6,
    `More opens a panel on screen (${more.links} links, inViewport=${more.inViewport})`
  );
  ok(more.overflowY === "auto", `the panel scrolls when it overflows (overflow-y: ${more.overflowY})`);
  ok(
    more.afterOutside === "none" && more.triggerClean === true && more.reopened === "block" && more.afterEscape === "none",
    "an outside tap and Escape both close it, and it reopens"
  );

  // The desktop header's MORE is the same panel.
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.waitForTimeout(400);
  const desktopMore = await p.evaluate(async () => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => /^more$/i.test((b.textContent || "").trim()) && b.getClientRects().length
    );
    btn?.click();
    await new Promise((r) => setTimeout(r, 300));
    const panel = document.getElementById("our-more-panel");
    const open = panel ? getComputedStyle(panel).display : null;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return { clicked: !!btn, open };
  });
  ok(desktopMore.clicked && desktopMore.open === "block", "the desktop header's MORE still opens it");

  // The mobile Teen Chala carousel: three cards behind a sticky stage, and
  // nothing moved them after the scrape. The mapping is the original's own
  // (sampled at several scroll fractions): the row slides
  // translateX(-200vw x progress), and the lit card is round(progress x 2).
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
  const teen = await p.evaluate(async () => {
    const sec = document.querySelector('section[aria-label*="Teen Chala"]');
    if (!sec) return { error: "section missing" };
    const row = sec.querySelector('div[style*="width:300%"]');
    if (!row) return { error: "row missing" };
    const cards = [...row.children];
    const veils = cards.map((c) =>
      [...c.querySelectorAll("div")].find(
        (d) => /opacity/.test(d.getAttribute("style") || "") && /transition/.test(d.getAttribute("style") || "")
      )
    );
    const top = sec.getBoundingClientRect().top + scrollY;
    const h = sec.offsetHeight;
    const steps = [];
    for (const f of [0.1, 0.25, 0.5, 0.75]) {
      scrollTo(0, top + f * h);
      await new Promise((r) => setTimeout(r, 350));
      const progress = Math.min(1, Math.max(0, (f * h) / (h - innerHeight)));
      steps.push({
        f,
        want: -200 * progress,
        got: parseFloat((row.style.transform.match(/-?[\d.]+/) || ["0"])[0]),
        ops: veils.map((v) => v?.style.opacity),
      });
    }
    return { cards: cards.length, steps };
  });
  ok(teen.cards === 3, `three cards in the carousel (${teen.cards || teen.error})`);
  const offTrack = (teen.steps || []).filter((s) => !(Math.abs(s.got - s.want) <= 2));
  ok(
    teen.steps?.length === 4 && offTrack.length === 0,
    "the row slides with the section" +
      (offTrack.length
        ? ": " + offTrack.map((s) => `f=${s.f} got ${s.got}, want ${s.want.toFixed(1)}`).join(" | ")
        : "")
  );
  const at = (f) => teen.steps?.find((s) => s.f === f);
  ok(
    JSON.stringify(at(0.25)?.ops) === JSON.stringify(["0.3", "1", "0.3"]),
    `a quarter in, the middle card is lit (${at(0.25)?.ops})`
  );
  ok(
    JSON.stringify(at(0.5)?.ops) === JSON.stringify(["0.3", "0.3", "1"]),
    `halfway, the third card takes over (${at(0.5)?.ops})`
  );
  ok(
    JSON.stringify(at(0.75)?.ops) === JSON.stringify(["0.3", "0.3", "1"]) && at(0.75)?.got === -200,
    `past three quarters it stays clamped on the third (${at(0.75)?.got}vw)`
  );
  ok(errs.length === 0, "mobile more + teen chala console clean" + (errs.length ? ": " + [...new Set(errs)].join(" | ") : ""));
  await p.close();
}

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
    .waitForFunction(() => !!document.querySelector("[data-map-canvas].leaflet-container"), null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  ok(mapUp, "leaflet pane attached after client nav");
  await nav.waitForTimeout(2500);
  const m1 = await nav.evaluate(() => ({
    canvas: !!document.querySelector("[data-map-canvas].leaflet-container"),
    pane: !!document.querySelector(".leaflet-pane"),
    tiles: document.querySelectorAll(".leaflet-tile-loaded").length,
    markers: document.querySelectorAll(".custom-pandal-marker").length,
  }));
  ok(m1.canvas && m1.pane && m1.tiles > 0 && m1.markers >= 100, `map rendered after client nav (tiles=${m1.tiles}, markers=${m1.markers})`);

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

  // Search has to reach the whole directory on its own. The original's own
  // search for "bagbazar" returns nine pandals, most of them spelled
  // "Baghbazar", and none of them can be on screen while only the first page
  // is rendered. Running it before the scroll-load proves the search reads
  // the dataset rather than the cards that happen to exist.
  const BAGBAZAR = [
    "bagbazar-pally-puja-o-prodorshoni",
    "bagbazar-sarbojanin-durga-puja-mandap",
    "basu-bati-bagbazar",
    "baghbazar-haldar-bari-puja",
    "naba-baghbazar-sarbajanin-durga-puja",
    "raja-raj-ballav-street-sadanga-durgoutsav-samiti",
    "kumortuli-sarbojonin-durgotsab",
    "tal-betal-durga-puja",
    "saterpalli-sarbojanin-durgotsav-committee",
  ];
  const bag = await p.evaluate(async ({ sel, want }) => {
    const i = document.querySelector('input[placeholder*="Search pandal"]');
    i.value = "bagbazar";
    i.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 700));
    const shown = [...document.querySelectorAll(sel)].filter((a) => a.getClientRects().length);
    const slugs = shown.map((a) => a.getAttribute("href").split("/").pop());
    return {
      slugs,
      dupes: slugs.filter((s, k) => slugs.indexOf(s) !== k),
      cards: document.querySelectorAll(sel).length,
      missing: want.filter((s) => !slugs.includes(s)),
      count: document.querySelector("[data-paras-count]")?.textContent || "",
    };
  }, { sel: CARD, want: BAGBAZAR });
  ok(
    bag.missing.length === 0,
    `search finds the original's nine "bagbazar" pandals across the spellings (${bag.slugs.length} hits, missing ${bag.missing.join(", ") || "none"})`
  );
  ok(bag.dupes.length === 0, `search results carry no duplicate cards (${bag.dupes.join(", ") || "none"})`);
  ok(
    bag.cards < 776 && /Showing \d+ of 776/.test(bag.count),
    `search renders its matches without loading the directory first (${bag.cards} cards, "${bag.count}")`
  );
  await p.evaluate(() => {
    const i = document.querySelector('input[placeholder*="Search pandal"]');
    i.value = "";
    i.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await p.waitForTimeout(400);

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

  // List view used to strip every card's `block h-full` classes while the
  // component's own queries keyed off them, so the mode reported "Showing 0
  // of 776" and the chips and search went silent on the next click. It is a
  // display state on frozen cards now.
  const listMode = await p.evaluate(async (sel) => {
    const btn = (label) =>
      [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label);
    const chip = (l) =>
      [...document.querySelectorAll("main button")].find(
        (x) => x.innerText.trim().toLowerCase().replace(/\d+\s*$/, "").trim() === l
      );
    const paint = () => {
      const bg = (l) => {
        const el = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === l);
        return el ? getComputedStyle(el).backgroundColor : null;
      };
      return { grid: bg("Grid View"), list: bg("List View") };
    };
    btn("List View").click();
    await new Promise((r) => setTimeout(r, 450));
    const cards = [...document.querySelectorAll(sel)].filter((a) => a.getClientRects().length);
    const out = {
      count: document.querySelector("[data-paras-count]")?.textContent || "",
      rowH: cards[0]?.getBoundingClientRect().height ?? 0,
      classKept: (cards[0]?.className || "").includes("block"),
      paintList: paint(),
    };
    chip("north").click();
    await new Promise((r) => setTimeout(r, 550));
    out.northVisible = [...document.querySelectorAll(sel)].filter((a) => a.getClientRects().length).length;
    chip("all").click();
    await new Promise((r) => setTimeout(r, 350));
    btn("Grid View").click();
    await new Promise((r) => setTimeout(r, 450));
    out.gridH = document.querySelectorAll(sel)[0]?.getBoundingClientRect().height ?? 0;
    out.gridVisible = [...document.querySelectorAll(sel)].filter((a) => a.getClientRects().length).length;
    out.paintGrid = paint();
    return out;
  }, CARD);
  ok(/Showing all 776/.test(listMode.count), `list view keeps the directory count (${listMode.count})`);
  ok(listMode.rowH > 0 && listMode.rowH < 120, `list view renders slim rows (${Math.round(listMode.rowH)}px)`);
  ok(listMode.classKept, "cards keep the classes every query keys off through a mode switch");
  ok(
    listMode.northVisible === expectedZones.north,
    `the chips filter in list view (${listMode.northVisible}/${expectedZones.north})`
  );
  ok(
    listMode.gridVisible === loaded.expected && listMode.gridH > 200,
    `grid view restores the full cards (${listMode.gridVisible}, ${Math.round(listMode.gridH)}px)`
  );
  // The pressed look is a class swap between the toggle's two scraped
  // states; painting inline styles underneath left Grid's own pressed class
  // in place, so both buttons looked pressed in list view.
  const PRESSED = "rgb(217, 4, 41)";
  ok(
    listMode.paintList.grid !== PRESSED && listMode.paintList.list === PRESSED,
    `list view lights only the List button (grid ${listMode.paintList.grid}, list ${listMode.paintList.list})`
  );
  ok(
    listMode.paintGrid.grid === PRESSED && listMode.paintGrid.list !== PRESSED,
    `grid view lights only the Grid button (grid ${listMode.paintGrid.grid}, list ${listMode.paintGrid.list})`
  );

  // The sort dropdown shipped as the original's closed button ("Popular")
  // with no listbox behind it: the listbox only exists while open, so the
  // scrape missed it and pressing it did nothing.
  const sortAll = await p.evaluate(async (sel) => {
    const btn = document.querySelector('main button[aria-haspopup="listbox"]');
    const label = () => (btn.querySelector("div span") || btn).textContent.trim();
    const openOption = async (re) => {
      btn.click();
      await new Promise((r) => setTimeout(r, 300));
      const box = document.querySelector('[role="listbox"]');
      [...box.querySelectorAll('[role="option"]')].find((x) => re.test(x.textContent)).click();
      await new Promise((r) => setTimeout(r, 700));
    };
    const firstVisible = () =>
      [...document.querySelectorAll(sel)]
        .find((a) => a.getClientRects().length)
        ?.getAttribute("href")
        .split("/")
        .pop();
    const out = { before: firstVisible() };
    const data = await (await fetch("/paras.json")).json();

    btn.click();
    await new Promise((r) => setTimeout(r, 300));
    const box = document.querySelector('[role="listbox"]');
    out.open = !!box && getComputedStyle(box).display !== "none";
    out.options = box ? [...box.querySelectorAll('[role="option"]')].map((x) => x.textContent.trim()) : [];
    out.selected = box
      ? [...box.querySelectorAll('[role="option"][aria-selected="true"]')].map((x) => x.textContent.trim())
      : [];
    out.expanded = btn.getAttribute("aria-expanded");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    out.afterEscape = box ? getComputedStyle(box).display : null;
    btn.click();
    await new Promise((r) => setTimeout(r, 250));
    document.querySelector("main h1")?.click();
    await new Promise((r) => setTimeout(r, 200));
    out.afterOutside = box ? getComputedStyle(box).display : null;

    await openOption(/Alphabetical/);
    out.alphaLabel = label();
    out.alphaFirst = firstVisible();
    out.alphaExpected = [...data].sort((a, b) =>
      new Intl.Collator("en", { numeric: true, sensitivity: "base" }).compare(a.name, b.name)
    )[0].slug;

    await openOption(/Top Rated/);
    out.ratedLabel = label();
    out.ratedCount = document.querySelector("[data-paras-count]")?.textContent || "";
    const rated = new Set(data.filter((x) => (x.rating ?? 0) >= 4.9).map((x) => x.slug));
    const shown = [...document.querySelectorAll(sel)].filter((a) => a.getClientRects().length);
    out.ratedVisible = shown.length;
    out.ratedExpected = rated.size;
    out.ratedExtras = shown
      .map((a) => a.getAttribute("href").split("/").pop())
      .filter((s) => !rated.has(s));
    const topSlug = out.ratedExtras.length ? null : shown[0]?.getAttribute("href").split("/").pop();
    out.ratedTop = data.find((x) => x.slug === topSlug)?.rating;

    await openOption(/Popular/);
    out.popularLabel = label();
    out.popularFirst = firstVisible();
    out.popularCount = document.querySelector("[data-paras-count]")?.textContent || "";
    out.tempLeft = document.querySelectorAll("[data-paras-temp]").length;
    // What this once was: a later dropdown click matched ClientNav's
    // accordion handler and took the view toggle down with it.
    out.viewButtons = [...document.querySelectorAll("button")]
      .filter((b) => /Grid View|List View/.test(b.getAttribute("aria-label") || ""))
      .filter((b) => b.getClientRects().length).length;
    return out;
  }, CARD);
  ok(sortAll.open, "sort dropdown opens");
  ok(
    JSON.stringify(sortAll.options) === JSON.stringify(["Popular", "Top Rated (★ 4.9+)", "Alphabetical (A-Z)"]),
    `sort offers the original's three options (${sortAll.options.join(" / ")})`
  );
  ok(
    sortAll.selected.length === 1 && sortAll.expanded === "true",
    `the open listbox marks exactly one option (${sortAll.selected.join("")}, aria-expanded=${sortAll.expanded})`
  );
  ok(sortAll.afterEscape === "none" && sortAll.afterOutside === "none", "Escape and a click away both close it");
  ok(
    sortAll.alphaLabel === "Alphabetical (A-Z)" && sortAll.alphaFirst === sortAll.alphaExpected,
    `Alphabetical sorts by name with numbers read as numbers (first: ${sortAll.alphaFirst})`
  );
  ok(
    sortAll.alphaFirst === "7-tanks-durga-puja-pandal",
    "Alphabetical starts where the original's own listing starts (7 Tanks)"
  );
  ok(
    sortAll.ratedLabel === "Top Rated (★ 4.9+)" &&
      sortAll.ratedVisible === sortAll.ratedExpected &&
      sortAll.ratedExtras.length === 0 &&
      sortAll.ratedTop === 5,
    `Top Rated keeps the ★ 4.9+ set, best first (${sortAll.ratedVisible}/${sortAll.ratedExpected}, top ★${sortAll.ratedTop})`
  );
  ok(/Showing 102 of 776/.test(sortAll.ratedCount), `Top Rated counts its own set (${sortAll.ratedCount})`);
  ok(
    sortAll.popularLabel === "Popular" &&
      sortAll.popularFirst === sortAll.before &&
      /Showing all 776/.test(sortAll.popularCount) &&
      sortAll.tempLeft === 0,
    `Popular restores the directory order (${sortAll.popularFirst}, "${sortAll.popularCount}")`
  );
  ok(
    sortAll.viewButtons === 2,
    `opening the dropdown four times leaves the Grid/List toggle alone (${sortAll.viewButtons} visible)`
  );

  // A pressed chip used to look exactly like an unpressed one: no sign of
  // what was filtering the view. Zone chips now light up in their own dot
  // colour, All in ink, and Featured/Saved take the original's own pressed
  // classes (data/paras-ui.json).
  const chipPaint = await p.evaluate(async () => {
    const chip = (l) =>
      [...document.querySelectorAll("main button")].find(
        (x) => x.innerText.trim().toLowerCase().replace(/\d+\s*$/, "").trim() === l
      );
    const snap = (l) => {
      const c = chip(l);
      return { cls: c.className, style: c.getAttribute("style") || "" };
    };
    const out = {};
    chip("north").click();
    await new Promise((r) => setTimeout(r, 350));
    out.north = snap("north");
    out.allWhileNorth = snap("all");
    chip("featured").click();
    await new Promise((r) => setTimeout(r, 350));
    out.featured = snap("featured");
    out.northAfter = snap("north");
    chip("saved").click();
    await new Promise((r) => setTimeout(r, 350));
    out.saved = snap("saved");
    out.featuredAfter = snap("featured");
    chip("all").click();
    await new Promise((r) => setTimeout(r, 350));
    out.allBack = snap("all");
    out.northBack = snap("north");
    return out;
  });
  const CHIP_OFF = "background-color:#FFFFFF;color:#2C1210;border-color:#EAD5A0";
  ok(
    /background-color:\s*#4F46E5/i.test(chipPaint.north.style) && /color:\s*#FFFFFF/i.test(chipPaint.north.style),
    `a pressed zone chip takes its own dot colour (${chipPaint.north.style})`
  );
  ok(
    chipPaint.allWhileNorth.style === CHIP_OFF,
    `All unpaints when a zone takes over (${chipPaint.allWhileNorth.style})`
  );
  ok(
    chipPaint.featured.cls.includes("from-[#D90429] to-[#B80322]") && chipPaint.featured.cls.includes("text-white"),
    "Featured takes the original's pressed gradient"
  );
  ok(
    chipPaint.saved.cls.includes("bg-[#D90429]") && chipPaint.saved.cls.includes("text-white"),
    "Saved takes the original's pressed red"
  );
  ok(
    chipPaint.northAfter.style === CHIP_OFF && chipPaint.featuredAfter.cls.includes("bg-white"),
    "switching chips unpaints the one before"
  );
  ok(
    /background-color:\s*#2C1210/i.test(chipPaint.allBack.style) && chipPaint.northBack.style === CHIP_OFF,
    `All paints in ink when pressed (${chipPaint.allBack.style})`
  );

  // Search must reach beyond the server-rendered 24.
  const midName = await p.evaluate(async () => (await (await fetch("/paras.json")).json())[400].name);
  await p.evaluate((t) => {
    const i = document.querySelector('input[placeholder*="Search pandal"]');
    i.value = t;
    i.dispatchEvent(new Event("input", { bubbles: true }));
  }, midName);
  await p.waitForTimeout(500);
  ok((await visible()) === 1, `search reaches a pandal outside the first 24 (${midName.slice(0, 30)})`);

  // Saved must survive a reload. Saving is an account action now, so the
  // page is signed in through the mock API's cookie first.
  await p.evaluate(() => {
    const i = document.querySelector('input[placeholder*="Search pandal"]');
    i.value = "";
    i.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await p.waitForTimeout(250);
  // A fresh user per run: the mock API keeps its store in memory, so a
  // leftover save from an earlier run would turn the toggle into a removal.
  const verifier = `verifier-${Date.now()}`;
  await p.context().addCookies([{ name: "ss_mock_user", value: verifier, url: B }]);
  await p.reload({ waitUntil: "load" });
  // The account resolves from the API, and saving while it is still loading
  // sends the visitor to sign in instead.
  await p
    .waitForFunction(() => document.documentElement.dataset.authState === "signed-in", null, {
      timeout: 8000,
    })
    .catch(() => {});
  await p.evaluate(() => {
    document.querySelector('a.block.h-full[href^="/paras/"] [aria-label="Save Pandal"]').click();
  });
  await p.waitForTimeout(600);
  await p.reload({ waitUntil: "load" });
  // The account's save list arrives from the API, so the badge settles a
  // moment after the reload.
  await p
    .waitForFunction(
      () => {
        const btn = [...document.querySelectorAll("main button")].find((x) =>
          x.innerText.trim().toLowerCase().startsWith("saved")
        );
        return !!btn && /saved\s*1/i.test(btn.innerText.replace(/\s+/g, " "));
      },
      null,
      { timeout: 8000 }
    )
    .catch(() => {});
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

// ---------- guide sub-pages ----------
console.log("\n== GUIDE SUB-PAGES ==");
{
  // Each of the five sub-pages is static content: one <h1>, an intro, and a
  // fixed set of cards. The counts are asserted so a page that renders empty
  // or loses a card is caught - the mirror matched the original's rendered
  // text exactly on the day these were taken.
  const PAGES = [
    { slug: "accommodation", h1: "Where to Stay in Kolkata for Durga Puja", cards: 10, tel: 10 },
    { slug: "emergency", h1: "Emergency Contacts & Helplines", cards: 15, tel: 15 },
    { slug: "etiquette", h1: "Puja Etiquette & Festival Norms", cards: 4, tel: 0 },
    { slug: "food-trail", h1: "Kolkata Durga Puja Food Trail", cards: 12, tel: 0 },
    { slug: "photography", h1: "Durga Puja Photography & Lighting Tips", cards: 4, tel: 0 },
  ];

  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const gerrs = [];
  p.on("pageerror", (e) => gerrs.push(e.message.slice(0, 100)));
  p.on("console", (c) => c.type() === "error" && gerrs.push(c.text().slice(0, 100)));

  const allHrefs = new Set();
  for (const page of PAGES) {
    await ready(p, B + `/guide/${page.slug}/`);
    const r = await p.evaluate(() => {
      const m = document.querySelector("main");
      return {
        h1: m?.querySelector("h1")?.innerText.replace(/\s+/g, " ").trim() || "",
        h3: m?.querySelectorAll("h3").length || 0,
        // Callable rows: the emergency helplines and the hotel front desks.
        tel: [...(m?.querySelectorAll('a[href^="tel:"]') || [])].map((a) =>
          a.getAttribute("href")
        ),
        text: (m?.innerText || "").replace(/\s+/g, " ").trim().length,
        back: m?.querySelector('a[href="/guide"]')?.innerText.trim() || "",
        hrefs: [...document.querySelectorAll("a[href]")].map((a) =>
          a.getAttribute("href")
        ),
      };
    });
    for (const h of r.hrefs) if (h?.startsWith("/")) allHrefs.add(h.split("?")[0]);

    const label = `/guide/${page.slug}/`;
    ok(r.h1 === page.h1, `${label} heading (${r.h1.slice(0, 44)})`);
    ok(r.h3 === page.cards, `${label} renders all ${page.cards} cards (${r.h3})`);
    ok(r.text > 400, `${label} has its body copy (${r.text} chars)`);
    ok(r.back === "Back to Visitor Guide", `${label} links back to the guide index`);
    if (page.tel) {
      // Short codes like 100 and 1091 are as real as the landlines.
      const dialable = r.tel.filter((h) => /^tel:\+?[\d-]{3,}$/.test(h)).length;
      ok(
        dialable === page.tel,
        `${label} has ${page.tel} dialable numbers (${dialable})`
      );
    }
  }
  ok(gerrs.length === 0, "guide sub-pages console clean" + (gerrs.length ? ": " + [...new Set(gerrs)].join(" | ") : ""));

  // The chrome is shared, so a link removed from the footer or the mobile menu
  // must be gone from every page rather than from the one it was spotted on.
  const deadWanted = ["/admin/login", "/login", "/profile"];
  const stillThere = deadWanted.filter((h) => allHrefs.has(h));
  ok(
    stillThere.length === 0,
    "removed account and admin links stay removed" + (stillThere.length ? ": " + stillThere.join(", ") : "")
  );
  const chrome = await p.evaluate(() => document.body.innerText);
  ok(
    !/Admin Portal|My Routes/.test(chrome),
    "no sign-in or admin labels remain in the chrome"
  );

  // Every internal destination these pages offer has to answer. This is the
  // check that would have caught the three dead links in the first place.
  const targets = [...allHrefs].filter((h) => !h.startsWith("/cdn-cgi/"));
  const broken = [];
  for (const href of targets) {
    const res = await p.request.get(B + href);
    if (res.status() !== 200) broken.push(`${href} (${res.status()})`);
  }
  ok(
    broken.length === 0,
    `all ${targets.length} internal links on the guide pages resolve` +
      (broken.length ? ": " + broken.slice(0, 4).join(", ") : "")
  );
  await p.close();
}

// ---------- guide topic tabs ----------
console.log("\n== GUIDE TABS ==");
{
  // The guide index shows one topic at a time behind five pills, and the
  // scrape kept only the panel the original happened to server-render, so
  // four of the five did nothing. The others are harvested into
  // data/guide-tabs.json and grafted in hidden; the pills swap between the
  // marked panels, which keeps the transit map's DOM alive.
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
  p.on("console", (c) => c.type() === "error" && errs.push(c.text().slice(0, 100)));
  await ready(p, B + "/guide/");
  await p.waitForTimeout(1500); // the map in the first panel

  const MARKERS = {
    "Where to Stay": "The Oberoi Grand",
    "Kolkata Food Trail": "Ganguram Sweets",
    "Emergency & Helplines": "Kolkata Police Control Room",
    "Photography & Customs": "Pandal Photography Tips",
  };
  const tabs = await p.evaluate(async (want) => {
    const buttons = [...document.querySelectorAll("[data-guide-tabs] [data-guide-tab]")];
    const panels = [...document.querySelectorAll("[data-guide-panel]")];
    const visible = () =>
      panels.filter((x) => getComputedStyle(x).display !== "none").map((x) => x.dataset.guidePanel);
    const active = () =>
      buttons.filter((x) => /bg-\[#D90429\]/.test(x.className)).map((x) => x.dataset.guideTab);
    const out = {
      labels: buttons.map((x) => x.dataset.guideTab),
      panels: panels.length,
      first: visible(),
      firstActive: active(),
      steps: [],
      mapKids: document.querySelector("[data-metro-map]")?.children.length || 0,
    };
    for (const [label, needle] of Object.entries(want)) {
      buttons.find((x) => x.dataset.guideTab === label)?.click();
      await new Promise((r) => setTimeout(r, 250));
      const vis = visible();
      const panel = panels.find((x) => x.dataset.guidePanel === vis[0]);
      out.steps.push({
        label,
        vis,
        active: active(),
        hasMarker: (panel?.innerText || "").includes(needle),
        chars: (panel?.innerText || "").length,
      });
    }
    buttons.find((x) => x.dataset.guideTab === out.labels[0])?.click();
    await new Promise((r) => setTimeout(r, 250));
    out.backVisible = visible();
    out.mapKidsAfter = document.querySelector("[data-metro-map]")?.children.length || 0;
    return out;
  }, MARKERS);
  ok(
    tabs.labels.length === 5 && tabs.panels === 5,
    `five topic pills and five panels (${tabs.labels.length}/${tabs.panels})`
  );
  ok(
    tabs.first.length === 1 &&
      tabs.first[0] === tabs.labels[0] &&
      tabs.firstActive.length === 1 &&
      tabs.firstActive[0] === tabs.labels[0],
    `the first topic is the one showing and lit (${tabs.first.join("")})`
  );
  const stepsBad = tabs.steps.filter(
    (s) =>
      s.vis.length !== 1 ||
      s.vis[0] !== s.label ||
      s.active.length !== 1 ||
      s.active[0] !== s.label ||
      !s.hasMarker ||
      s.chars < 200
  );
  ok(
    stepsBad.length === 0,
    "every pill swaps in its own harvested panel and lights itself" +
      (stepsBad.length
        ? ": " + stepsBad.map((s) => `${s.label} (${s.vis.join("|")}, marker=${s.hasMarker}, ${s.chars} chars)`).join(" | ")
        : "")
  );
  ok(
    tabs.backVisible.length === 1 && tabs.backVisible[0] === tabs.labels[0] && tabs.mapKids > 0 && tabs.mapKidsAfter === tabs.mapKids,
    `returning to the first topic keeps the transit map (${tabs.mapKids} nodes)`
  );
  ok(errs.length === 0, "guide tabs console clean" + (errs.length ? ": " + [...new Set(errs)].join(" | ") : ""));
  await p.close();
}

// ---------- the pages polished after the first pass ----------
console.log("\n== EVENTS + EDEN GARDENS ==");
{
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
  p.on("console", (c) => c.type() === "error" && errs.push(c.text().slice(0, 100)));

  await ready(p, B + "/events/");
  const card = await p.evaluate(() => {
    // The card is a div; its CTA is the anchor inside it.
    const link = document.querySelector('main a[href="/eden-gardens-live"]');
    return {
      href: link?.getAttribute("href") || "",
      text: (link?.parentElement?.innerText || "").replace(/\s+/g, " ").trim(),
    };
  });
  ok(card.href === "/eden-gardens-live", `events: the broadcast card links to the replay (${card.href})`);
  ok(
    // The badge is uppercased by CSS, so innerText reports it in caps.
    /full broadcast recording/i.test(card.text) &&
      /10 October 2026/.test(card.text) &&
      /Eden Gardens Mahalaya 2026 Mega Celebration/.test(card.text),
    "events: the card keeps the original's badge, date and title"
  );

  // The card was added because the original's own CTA pointed at a page the
  // scrape had not mirrored; the destination has to answer.
  const res = await p.request.get(B + card.href);
  ok(res.status() === 200, `events: the replay page answers (${res.status()})`);

  await ready(p, B + "/eden-gardens-live/");
  const theater = await p.evaluate(async () => {
    const wrap = document.querySelector("[data-eden-wrap]");
    const btn = document.querySelector("[data-eden-theater]");
    const label = () => document.querySelector("[data-eden-label]")?.textContent || "";
    const before = { cls: wrap?.className || "", label: label() };
    btn?.click();
    await new Promise((r) => setTimeout(r, 150));
    const on = { cls: wrap?.className || "", label: label() };
    btn?.click();
    await new Promise((r) => setTimeout(r, 150));
    const off = { cls: wrap?.className || "", label: label() };
    return { before, on, off, iframe: !!document.querySelector('iframe[src*="youtube"]') };
  });
  ok(
    /max-w-5xl/.test(theater.before.cls) && theater.before.label === "Theater Mode",
    "eden: theater mode starts off"
  );
  ok(
    /max-w-7xl/.test(theater.on.cls) && !/max-w-5xl/.test(theater.on.cls) && theater.on.label === "Standard View",
    "eden: theater mode widens the column and relabels itself"
  );
  ok(
    /max-w-5xl/.test(theater.off.cls) && theater.off.label === "Theater Mode",
    "eden: pressing it again restores the standard view"
  );
  ok(theater.iframe, "eden: the broadcast player is embedded");

  // Share: headless has no share sheet, so the original's own fallback - copy
  // the URL and show "Link Copied" for 2.5 s - is the path to check. Some
  // builds of this browser do expose navigator.share without a sheet behind
  // it, which would leave the click waiting forever, so the fallback is
  // forced by hiding the API first.
  await p.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "share", {
      value: undefined,
      configurable: true,
    });
  });
  await p.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: B });
  await p.bringToFront();
  await p.click("[data-eden-share]");
  const copied = await p
    .waitForFunction(
      () => /Link Copied/.test(document.querySelector("[data-eden-share]")?.textContent || ""),
      null,
      { timeout: 5000 }
    )
    .then(() => true)
    .catch(() => false);
  ok(copied, "eden: share falls back to copying the link and says so");
  const reverted = await p
    .waitForFunction(
      () => /^Share/.test((document.querySelector("[data-eden-share]")?.textContent || "").trim()),
      null,
      { timeout: 5000 }
    )
    .then(() => true)
    .catch(() => false);
  ok(reverted, "eden: the copied state clears itself");
  // The Eden page embeds a YouTube iframe, and Chrome logs a permissions
  // policy notice for it. That is the embed's noise, not the site's.
  const edenErrs = errs.filter((e) => !/Permissions policy violation/i.test(e));
  ok(
    edenErrs.length === 0,
    "events + eden console clean" + (edenErrs.length ? ": " + [...new Set(edenErrs)].join(" | ") : "")
  );
  await p.close();
}

console.log("\n== ABOUT-US JOURNEY ==");
{
  // The original keeps five of the six day panels in its client component and
  // server-renders only the day it happens to open on. data/about-days.json
  // holds all six, captured by clicking each tab in a real browser.
  const DAYS = [
    ["Mahalaya", "Mahalaya: The Celestial Reawakening"],
    ["Maha Shasthi", "Maha Shasthi: Bodhon & Sacred Unveiling"],
    ["Maha Saptami", "Maha Saptami: Nabapatrika Snan"],
    ["Maha Ashtami", "Maha Ashtami: Kumari Puja & Sandhi Puja"],
    ["Maha Navami", "Maha Navami: Maha Arati & Dhunuchi Naach"],
    ["Bijoya Dashami", "Bijoya Dashami: Sindoor Khela & Immersion"],
  ];
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
  p.on("console", (c) => c.type() === "error" && errs.push(c.text().slice(0, 100)));

  await ready(p, B + "/about-us/");
  const initial = await p.evaluate(() => {
    const panel = document.querySelector("[data-about-panel]");
    const buttons = [...document.querySelectorAll("[data-about-day]")];
    return {
      tabs: buttons.map((b) => b.dataset.aboutDay),
      active: buttons.find((b) => (b.className || "").includes("bg-[#D90429]"))?.dataset.aboutDay || "",
      heading: panel?.querySelector("h3")?.textContent?.trim() || "",
    };
  });
  ok(initial.tabs.length === 6, `about-us: six day tabs (${initial.tabs.join(" · ")})`);
  ok(initial.active === "Maha Ashtami", `about-us: today's tab is the one in view (${initial.active})`);
  ok(
    initial.heading === "Maha Ashtami: Kumari Puja & Sandhi Puja",
    "about-us: the server-rendered panel is the harvested one"
  );

  const problems = [];
  for (const [day, heading] of DAYS) {
    const r = await p.evaluate(async (d) => {
      document.querySelector(`[data-about-day="${d}"]`)?.click();
      await new Promise((r) => setTimeout(r, 200));
      const panel = document.querySelector("[data-about-panel]");
      return {
        heading: panel?.querySelector("h3")?.textContent?.trim() || "",
        text: (panel?.innerText || "").replace(/\s+/g, " ").trim().length,
        active: [...document.querySelectorAll("[data-about-day]")]
          .filter((b) => (b.className || "").includes("bg-[#D90429]"))
          .map((b) => b.dataset.aboutDay),
      };
    }, day);
    if (r.heading !== heading) problems.push(`${day}: heading "${r.heading}"`);
    if (r.text < 300) problems.push(`${day}: only ${r.text} chars`);
    if (r.active.length !== 1 || r.active[0] !== day) {
      problems.push(`${day}: active=${r.active.join("+") || "none"}`);
    }
  }
  ok(
    problems.length === 0,
    "about-us: every day swaps in its own panel" +
      (problems.length ? ": " + problems.slice(0, 3).join(" | ") : "")
  );
  // The creator cards carried Cloudflare's email-decoy anchors, which resolve
  // nowhere without Cloudflare's script and whose payloads are the operators'
  // private addresses. They are removed rather than left dead.
  const decoys = await p.evaluate(
    () =>
      document.querySelectorAll('main a[href^="/cdn-cgi/"], main a.__cf_email__').length
  );
  ok(decoys === 0, `about-us: no Cloudflare email decoys are shipped (${decoys})`);
  ok(
    errs.length === 0,
    "about-us console clean" + (errs.length ? ": " + [...new Set(errs)].join(" | ") : "")
  );
  await p.close();
}

console.log("\n== POINTS OF INTEREST ==");
{
  // The original server-renders 119 places and then fetches /api/pois on mount
  // and swaps in all 273. The build renders the full directory from
  // data/pois.json, and this component checks the search, the chips and the
  // empty state against that same live list.
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
  p.on("console", (c) => c.type() === "error" && errs.push(c.text().slice(0, 100)));

  await ready(p, B + "/points-of-interest/");
  const base = await p.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-poi-card]")];
    // Only the chip row carries chips; the cards carry the category too.
    const chips = [...document.querySelectorAll("[data-poi-chips] [data-poi-cat]")];
    return {
      cards: cards.length,
      chips: chips.length,
      all: chips.find((b) => b.dataset.poiCat === "all")?.textContent?.trim() || "",
      phones: cards.filter((c) => c.querySelector('a[href^="tel:"]')).length,
      maps: cards.filter((c) => /^\/map\?lat=[-\d.]+&lng=[-\d.]+$/.test(
        c.querySelector('a[href^="/map?"]')?.getAttribute("href") || ""
      )).length,
      emptyHidden: document.querySelector("[data-poi-empty]")?.hidden,
    };
  });
  ok(base.cards === 273, `poi: all 273 places render (${base.cards})`);
  ok(base.all === "All (273)", `poi: the All chip counts the live directory (${base.all})`);
  ok(base.chips === 16, `poi: sixteen category chips (${base.chips})`);
  ok(base.phones === 26, `poi: the places with phone numbers keep them (${base.phones})`);
  ok(base.maps === base.cards, `poi: every card links to the map at its coordinates (${base.maps})`);
  ok(base.emptyHidden === true, "poi: the empty state starts hidden");

  const search = async (q) =>
    p.evaluate(async (text) => {
      const input = document.querySelector("[data-poi-search]");
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      set.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      const visible = [...document.querySelectorAll("[data-poi-card]")].filter((c) => !c.hidden);
      const empty = document.querySelector("[data-poi-empty]");
      return {
        n: visible.length,
        match: visible.every((c) => (c.dataset.poiKey || "").includes(text.toLowerCase())),
        empty: !empty?.hidden,
        emptyText: empty?.innerText.replace(/\s+/g, " ").trim() || "",
      };
    }, q);

  const kalighat = await search("kalighat");
  ok(
    kalighat.n > 0 && kalighat.match && !kalighat.empty,
    `poi: search narrows to name/address matches (${kalighat.n} for "kalighat")`
  );
  const none = await search("zzzzqqq");
  ok(
    none.n === 0 && none.empty && /No Facilities Found/.test(none.emptyText),
    "poi: a query that matches nothing shows the empty state"
  );

  await p.click("[data-poi-reset]");
  const reset = await p.evaluate(() => ({
    n: [...document.querySelectorAll("[data-poi-card]")].filter((c) => !c.hidden).length,
    value: document.querySelector("[data-poi-search]")?.value,
    emptyHidden: document.querySelector("[data-poi-empty]")?.hidden,
    allActive: (document.querySelector('[data-poi-chips] [data-poi-cat="all"]')?.className || "").includes("bg-[#D90429]"),
  }));
  ok(
    reset.n === 273 && reset.value === "" && reset.emptyHidden === true && reset.allActive,
    "poi: Reset Filters restores the full directory"
  );

  await p.click('[data-poi-chips] [data-poi-cat="metro-station"]');
  const metro = await p.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-poi-card]")];
    const visible = cards.filter((c) => !c.hidden);
    return {
      n: visible.length,
      only: visible.every((c) => c.dataset.poiCat === "metro-station"),
      chip: (document.querySelector('[data-poi-chips] [data-poi-cat="metro-station"]')?.className || "").includes(
        "bg-[#D90429]"
      ),
      all: (document.querySelector('[data-poi-chips] [data-poi-cat="all"]')?.className || "").includes("bg-[#D90429]"),
    };
  });
  ok(
    metro.n > 0 && metro.only && metro.chip && !metro.all,
    `poi: a category chip filters and shows as pressed (${metro.n} metro stations)`
  );

  await p.click('[data-poi-chips] [data-poi-cat="all"]');
  const backAll = await p.evaluate(
    () => [...document.querySelectorAll("[data-poi-card]")].filter((c) => !c.hidden).length
  );
  ok(backAll === 273, `poi: All returns the whole directory (${backAll})`);
  ok(
    errs.length === 0,
    "poi console clean" + (errs.length ? ": " + [...new Set(errs)].join(" | ") : "")
  );
  await p.close();
}

console.log("\n== UPLOAD ==");
{
  // The original answers /upload with a client-only "Community Archive" page
  // whose Google sign-in cannot work in a static export. The mirror is that
  // resolved state, with the sign-in calls replaced by a note and a way into
  // the gallery - and, crucially, no control left that does nothing.
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
  p.on("console", (c) => c.type() === "error" && errs.push(c.text().slice(0, 100)));

  await ready(p, B + "/upload/");
  const r = await p.evaluate(() => {
    const m = document.querySelector("main");
    const text = (m?.innerText || "").replace(/\s+/g, " ").trim();
    return {
      h1: m?.querySelector("h1")?.textContent?.trim() || "",
      text,
      buttons: m?.querySelectorAll("button").length ?? 0,
      gallery: [...(m?.querySelectorAll('a[href="/gallery"]') || [])].length,
      spinner: !!m?.querySelector(".animate-spin"),
    };
  });
  ok(r.h1 === "Share Your Durga Puja Photos", `upload: the archive page renders (${r.h1.slice(0, 44)})`);
  ok(!r.spinner, "upload: the never-resolving spinner is gone");
  ok(r.buttons === 0, `upload: no control is left dead (${r.buttons} buttons)`);
  ok(r.gallery >= 2, `upload: the header and the notice lead to the gallery (${r.gallery} links)`);
  ok(
    /read-only/.test(r.text) && !/Continue with Google|Sign In/.test(r.text),
    "upload: the notice explains why uploads are off"
  );
  const gallery = await p.request.get(B + "/gallery/");
  ok(gallery.status() === 200, `upload: the gallery it points at answers (${gallery.status()})`);
  ok(
    errs.length === 0,
    "upload console clean" + (errs.length ? ": " + [...new Set(errs)].join(" | ") : "")
  );
  await p.close();
}

console.log("\n== IMAGES ==");
{
  // The gallery is a harvest of the community archive's R2 objects. One of
  // them failed to download and rendered as a broken tile on both the home
  // strip and /gallery, so every image those pages ask for is now requested.
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const srcs = new Set();
  for (const path of ["/", "/gallery/"]) {
    await p.goto(B + path, { waitUntil: "domcontentloaded", timeout: 60000 });
    for (const s of await p.evaluate(() =>
      [...document.querySelectorAll('img[src^="/gallery/"]')].map((i) => i.getAttribute("src"))
    )) {
      srcs.add(s);
    }
  }
  const list = [...srcs];
  const missing = [];
  for (let i = 0; i < list.length; i += 16) {
    const chunk = list.slice(i, i + 16);
    const res = await Promise.all(chunk.map((s) => p.request.head(B + s)));
    res.forEach((r, k) => {
      if (r.status() !== 200) missing.push(`${chunk[k]} (${r.status()})`);
    });
  }
  ok(
    // The gallery page is a marquee of 46 photos and the home strip adds ten
    // more; the union was 55 when this was written.
    list.length >= 50 && missing.length === 0,
    `every gallery image answers (${list.length} images)` +
      (missing.length ? ": " + missing.slice(0, 3).join(", ") : "")
  );
  await p.close();
}

// ---------- account & AI planner ----------
console.log("\n== ACCOUNT & AI PLANNER ==");
{
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
  p.on("console", (c) => c.type() === "error" && errs.push(c.text().slice(0, 100)));
  await ready(p, B + "/map/");

  const signedOut = await p.evaluate(() => ({
    me: document.documentElement.dataset.authState,
  }));
  ok(signedOut.me === "signed-out", `the site knows it is signed out (${signedOut.me})`);

  // The sign-in lives inside the MORE menu, where the site's other
  // destinations are.
  await p.locator("button", { hasText: /^more$/i }).first().click();
  await p.waitForTimeout(500);
  const morePanel = await p.evaluate(() => {
    const panel = document.getElementById("our-more-panel");
    return {
      open: !!panel && getComputedStyle(panel).display !== "none",
      signIn: !!panel && /sign in/i.test(panel.textContent || ""),
      slot: !!panel?.querySelector("#our-more-account"),
    };
  });
  ok(morePanel.open, "the MORE menu opens");
  ok(morePanel.signIn, "the MORE menu carries the sign-in control");
  ok(morePanel.slot, "the MORE menu holds the account slot");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);

  const anon = await p.evaluate(async () => {
    const saves = await fetch("/api/saves");
    const plan = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "3 hours in South Kolkata" }),
    });
    return { saves: saves.status, plan: plan.status };
  });
  ok(
    anon.saves === 401 && anon.plan === 401,
    `anonymous API calls are refused (${anon.saves}/${anon.plan})`
  );

  await p.locator("aside button", { hasText: "AI Planner" }).first().click();
  await p.waitForTimeout(400);
  const gated = await p.evaluate(() => {
    const aside = document.querySelector("aside");
    return {
      text: aside?.innerText || "",
      chat: !!aside?.querySelector('input[placeholder*="e.g."]'),
    };
  });
  // innerText reflects the button's upper-case transform.
  ok(/sign in to plan/i.test(gated.text), "the AI planner asks signed-out visitors to sign in");
  ok(!gated.chat, "the AI chat is not offered before sign-in");

  await p.context().addCookies([{ name: "ss_mock_user", value: `planner-${Date.now()}`, url: B }]);
  await p.reload({ waitUntil: "load" });
  await p
    .waitForFunction(() => document.documentElement.dataset.authState === "signed-in", null, {
      timeout: 8000,
    })
    .catch(() => {});
  await p.locator("aside button", { hasText: "AI Planner" }).first().click();
  await p.waitForTimeout(300);
  const chat = await p.evaluate(() => ({
    present: !!document.querySelector('input[placeholder*="e.g."]'),
    chips: [...document.querySelectorAll("aside button")].filter((b) =>
      /heritage|quiet|lighting|food trail|meet a friend/i.test(b.textContent)
    ).length,
  }));
  ok(chat.present, "the AI chat opens once signed in");
  ok(chat.chips >= 4, `the planner offers starting points (${chat.chips})`);

  await p.locator('input[placeholder*="e.g."]').fill("3 hours of lighting pandals in South Kolkata");
  await p.locator('button[aria-label="Send to the planner"]').click();
  // The answer arrives from the API, so it is waited for rather than
  // assumed to be there after a fixed pause.
  const answered = await p
    .waitForFunction(
      () => {
        const aside = document.querySelector("aside");
        const text = aside?.innerText || "";
        return /\bstops?\b/i.test(text) && !/Planning your route/.test(text)
          ? { text, paths: document.querySelectorAll("[data-map-canvas] .leaflet-overlay-pane path").length }
          : null;
      },
      null,
      { timeout: 15000 }
    )
    .then((handle) => handle.jsonValue())
    .catch(() => ({ text: "", paths: 0 }));
  ok(/stop/i.test(answered.text), `the planner answers with a stop list (${answered.text.slice(0, 40)})`);
  ok(answered.paths > 0, `the planned route is drawn on the map (${answered.paths} paths)`);

  await p.goto(B + "/profile/", { waitUntil: "load" });
  await p.waitForTimeout(1200);
  const profile = await p.evaluate(() => ({
    heading: document.querySelector("h1")?.textContent?.trim() || "",
  }));
  ok(/planner/i.test(profile.heading), `the profile shows the account (${profile.heading})`);

  // The profile page sits under the fixed navbar, so its content has to
  // start below it.
  const profileClear = await p.evaluate(() => {
    const head = [...document.querySelectorAll("header")].find(
      (h) => getComputedStyle(h).display !== "none" && h.getBoundingClientRect().height > 0
    );
    const hb = head.getBoundingClientRect();
    const h1 = document.querySelector("h1");
    return { headBottom: Math.round(hb.bottom), h1Top: Math.round(h1.getBoundingClientRect().top) };
  });
  ok(
    profileClear.h1Top > profileClear.headBottom,
    `the profile clears the fixed navbar (${profileClear.h1Top} > ${profileClear.headBottom})`
  );
  await p.close();

  // The AI planner has to be reachable on a phone too.
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  const merrs = [];
  m.on("pageerror", (e) => merrs.push(e.message.slice(0, 100)));
  m.on("console", (c) => c.type() === "error" && merrs.push(c.text().slice(0, 100)));
  await ready(m, B + "/map/");
  const aiButton = await m.locator('button[aria-label="Open the AI trip planner"]').count();
  ok(aiButton === 1, "the map offers an AI planner button on a phone");
  await m.locator('button[aria-label="Open the AI trip planner"]').click();
  await m.waitForTimeout(600);
  const mobileAi = await m.evaluate(() => {
    const panel = document.querySelector("[data-mobile-panel]");
    const body = document.querySelector("[data-mobile-panel-body]");
    return {
      open: !!body,
      tabs: [...(panel?.querySelectorAll("button") || [])].map((b) => b.textContent.trim()),
      signedOut: /sign in to plan/i.test(body?.textContent || ""),
    };
  });
  ok(mobileAi.open, "the AI planner opens in the phone panel");
  ok(
    mobileAi.tabs.some((t) => /ai planner/i.test(t)),
    `the phone panel has an AI Planner tab (${mobileAi.tabs.join("/")})`
  );
  ok(mobileAi.signedOut, "the phone AI planner asks signed-out visitors to sign in");
  ok(merrs.length === 0, "mobile account console clean" + (merrs.length ? ": " + [...new Set(merrs)].join(" | ") : ""));

  // The deliberate anonymous calls above answer 401, and the browser logs
  // that as a console error. It is the expected answer, not a fault.
  const realErrs = errs.filter((e) => !/401/.test(e));
  ok(
    realErrs.length === 0,
    "account console clean" + (realErrs.length ? ": " + [...new Set(realErrs)].join(" | ") : "")
  );
}

// ---------- page metadata ----------
console.log("\n== METADATA ==");
{
  // The mirror carries no <head>, so every route used to inherit one title
  // from the layout. These checks compare the built HTML against the harvested
  // data/meta.json directly, which is the same source generateMetadata reads -
  // so a wiring mistake shows up as a title that does not match its source.
  const meta = JSON.parse(
    await import("node:fs").then((fs) => fs.readFileSync("data/meta.json", "utf8"))
  ).routes;

  const SAMPLE = [
    "index",
    "gallery",
    "paras",
    "panzika",
    "map",
    "guide",
    "guide/etiquette",
    "guide/navigating-kolkata",
    "events",
    "about-us",
    "points-of-interest",
    "eden-gardens-live",
    "upload",
    "paras/22-no-pally-basi-bindo-durga-puja-pandal",
  ];

  const read = async (rel) => {
    const url = B + "/" + (rel === "index" ? "" : rel + "/");
    const res = await fetch(url);
    return res.text();
  };
  const field = (html, name) => {
    const m = html.match(new RegExp(`<meta\\s+(?:property|name)="${name}"\\s+content="([^"]*)"`, "i"));
    return m ? decode(m[1]) : "";
  };
  // Titles are HTML, so an ampersand arrives as &amp; and has to be put back
  // before it can be compared with the harvested text.
  const decode = (s) =>
    s
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'");

  const titles = new Map();
  const problems = [];
  let ogImages = 0;
  for (const rel of SAMPLE) {
    const html = await read(rel);
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
    const want = meta[rel]?.title || meta.home?.title;
    titles.set(rel, title);
    if (decode(title) !== want) {
      problems.push(`${rel}: got "${decode(title).slice(0, 40)}" want "${want?.slice(0, 40)}"`);
    }
    // Their host must never appear in our head, and the brand is ours.
    const head = html.slice(0, html.indexOf("</head>"));
    if (/durgapujakolkata|Sharodotsav/i.test(head)) problems.push(`${rel}: names the original`);
    const site = field(head, "og:site_name");
    if (site !== "Sharodsamagam") problems.push(`${rel}: og:site_name=${site || "missing"}`);
    const img = field(head, "og:image");
    if (!img.startsWith("https://sharodsamagam.dpdns.org/")) {
      problems.push(`${rel}: og:image=${img || "missing"}`);
    } else {
      ogImages++;
    }
  }
  ok(problems.length === 0, "titles match the harvested metadata" + (problems.length ? ": " + problems.slice(0, 3).join(" | ") : ` (${SAMPLE.length} routes)`));
  // The guide section deliberately shares one title across its pages - that is
  // what the original does - so the guide routes are exempted from the
  // distinctness check and asserted to share a single title instead. Everything
  // else stands on its own, which is the bug this section exists to prevent.
  //
  // /upload is the other deliberate exception: the original serves its home
  // title there too (the Community Archive is an overlay, not a document), so
  // the two are checked against each other rather than for uniqueness.
  const guideRoutes = SAMPLE.filter((r) => r === "guide" || r.startsWith("guide/"));
  const others = SAMPLE.filter((r) => !guideRoutes.includes(r) && r !== "upload");
  const otherTitles = new Set(others.map((r) => titles.get(r)));
  ok(
    otherTitles.size === others.length,
    `sampled routes carry their own titles (${otherTitles.size} distinct across ${others.length} routes)`
  );
  ok(
    titles.get("upload") === titles.get("index"),
    "the upload page keeps the home title, as the original does"
  );
  const guideTitles = new Set(guideRoutes.map((r) => titles.get(r)));
  ok(
    guideTitles.size === 1,
    `the guide section shares one title, as the original does (${guideTitles.size} across ${guideRoutes.length} routes)`
  );
  ok(ogImages === SAMPLE.length, "every sampled route advertises a share image on our origin");

  // Whatever the head advertises has to exist, or the preview breaks. The
  // advertised URL is absolute on our own host, so it is requested through the
  // local server the checks are pointed at.
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const img = field(await read("gallery"), "og:image");
  const imgRes = await p.request.get(B + new URL(img).pathname);
  ok(imgRes.status() === 200, `the share image resolves (${new URL(img).pathname} ${imgRes.status()})`);

  // Client-side navigation replaces the document title, so the tab keeps up.
  await ready(p, B + "/");
  const homeTitle = await p.title();
  await p.click('a[href="/gallery"]');
  await p.waitForTimeout(1500);
  const galleryTitle = await p.title();
  ok(
    galleryTitle !== homeTitle && /Gallery/i.test(galleryTitle),
    `client-side navigation updates the title ("${galleryTitle.slice(0, 40)}")`
  );
  await p.close();
}

// ---------- other pages ----------
console.log("\n== REGRESSION ==");
for (const [name, url] of [["/", "/"], ["/paras/", "/paras/"], ["/map/", "/map/"], ["/routes/", "/routes/"], ["/panzika/", "/panzika/"]]) {
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
