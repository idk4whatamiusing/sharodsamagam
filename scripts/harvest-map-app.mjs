#!/usr/bin/env node
/**
 * Harvests the real data behind durgapujakolkata.in/map and /routes.
 *
 *   data/map-pandals.json      617 geocoded pandals (/api/pandals?withCoords=true)
 *   data/map-routes.json       30 curated trails (/api/routes, trimmed)
 *   data/map-route-copy.json   card copy, trail sections, like labels (rendered DOM)
 *   public/map-routes-geo.json per-trail geometry + displayed mode estimates
 *   public/map/*.png           the original's two map pins
 *
 * Run with: node scripts/harvest-map-app.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ORIGIN = "https://www.durgapujakolkata.in";
const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const PUBLIC = path.join(ROOT, "public");
const MAP_ASSETS = path.join(PUBLIC, "map");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function getBinary(url, dest) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return fs.statSync(dest).size;
}

function trimPoi(p) {
  return {
    id: p.id ?? null,
    name: p.paraName || p.name || "",
    locality: p.locality || p.address || "",
    zone: p.zone || "",
    lat: Number(p.lat),
    lng: Number(p.lng),
    nearestMetro: p.nearestMetro || "",
  };
}

function trimPandal(p) {
  return {
    slug: p.slug,
    name: p.paraName,
    zone: p.zone,
    locality: p.locality || "",
    categories: p.categories || [],
    description: p.themeDescription || "",
    established: p.established ?? null,
    rating: p.rating ?? null,
    views: p.viewCount ?? null,
    crowd: p.crowdLevel || "medium",
    lat: Number(p.lat),
    lng: Number(p.lng),
    address: p.address || "",
    metro: p.nearestMetro || "",
    featured: !!p.isFeatured,
    verified: !!p.isVerified,
    image: typeof p.imageUrl === "string" && p.imageUrl.startsWith("/") ? p.imageUrl : "",
    coordinateStatus: p.coordinateStatus || "",
  };
}

function trimRoute(r) {
  return {
    id: r.id,
    shareCode: r.shareCode,
    number: r.routeNumber,
    title: r.title,
    zone: r.zone,
    metroHub: r.metroHub || "",
    earlyExits: r.earlyExits || "",
    bestUse: r.bestUse || "",
    finishLocation: r.finishLocation || "",
    travelMode: r.travelMode || "foot-walking",
    stopsCount: r.stopsCount || (r.waypoints?.length ?? 0) + 2,
    likeCount: r.likeCount ?? 0,
    start: r.start ? trimPoi(r.start) : null,
    end: r.end ? trimPoi(r.end) : null,
    waypoints: (r.waypoints || []).map(trimPoi),
    apiSummary: r.summary || null,
  };
}

async function dismissPromo(page) {
  await page
    .evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /dismiss and continue|dismiss promo|^dismiss$/i.test((x.innerText || "").trim())
      );
      b?.click();
    })
    .catch(() => {});
}

async function openTrails(page) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => (x.innerText || "").replace(/\s+/g, " ").trim() === "Curated Trails"
    );
    b?.click();
  });
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("button")].filter(
          (b) => (b.textContent || "").replace(/\s+/g, " ").trim() === "Plot on Map"
        ).length >= 30,
      { timeout: 30000 }
    )
    .catch(() => {});
  await page.waitForTimeout(300);
}

/** Locate the trail card that owns the nth "Plot on Map" button. */
const cardFromPlot = (n) => {
  const txt = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const plots = [...document.querySelectorAll("button")].filter((b) => txt(b) === "Plot on Map");
  let card = plots[n];
  for (let i = 0; i < 8 && card; i++) {
    card = card.parentElement;
    if (!card) break;
    if (/ROUTE DPKR\d+/i.test(txt(card)) && /Start:/.test(txt(card))) break;
  }
  return card;
};

function secondsFromLabel(label) {
  if (!label) return null;
  const hm = String(label).match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/);
  if (hm && (hm[1] || hm[2])) return Number(hm[1] || 0) * 3600 + Number(hm[2] || 0) * 60;
  const hr = String(label).match(/(\d+)\s*hr(?:s)?\s*(\d+)?\s*min/i);
  if (hr) return Number(hr[1]) * 3600 + Number(hr[2] || 0) * 60;
  return null;
}

function parseFlight(text) {
  const m = text.match(/1:(\{.*\})/s);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function collectCoords(geoJson) {
  const out = [];
  for (const f of geoJson?.features || []) {
    for (const [lng, lat] of f.geometry?.coordinates || []) {
      out.push([Number(Number(lat).toFixed(5)), Number(Number(lng).toFixed(5))]);
    }
  }
  return out;
}

async function main() {
  fs.mkdirSync(DATA, { recursive: true });
  fs.mkdirSync(MAP_ASSETS, { recursive: true });

  // ---------------------------------------------------------------- API data
  console.log("fetching /api/pandals?withCoords=true ...");
  const pandalsResp = await getJson(`${ORIGIN}/api/pandals?withCoords=true`);
  const pandals = (pandalsResp.pandals || []).map(trimPandal).filter((p) => p.lat && p.lng);
  fs.writeFileSync(path.join(DATA, "map-pandals.json"), JSON.stringify(pandals) + "\n");
  console.log(`  ${pandals.length} map pandals -> data/map-pandals.json`);

  console.log("fetching /api/routes ...");
  const routesResp = await getJson(`${ORIGIN}/api/routes`);
  const routes = (routesResp.routes || [])
    .filter((r) => r.isCurated)
    .map(trimRoute)
    .sort((a, b) => a.number - b.number);
  fs.writeFileSync(path.join(DATA, "map-routes.json"), JSON.stringify(routes) + "\n");
  console.log(`  ${routes.length} trails -> data/map-routes.json`);

  console.log("fetching /api/pois (sanity check) ...");
  const poisResp = await getJson(`${ORIGIN}/api/pois`);
  console.log(`  ${(poisResp.pois || []).length} POIs (data/pois.json stays the source)`);

  for (const file of ["para_icon.png", "featured_pandals.png"]) {
    const size = await getBinary(`${ORIGIN}/map/${file}`, path.join(MAP_ASSETS, file));
    console.log(`asset /map/${file} -> public/map (${size} bytes)`);
  }

  // ------------------------------------------------------- browser harvesting
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  // ---------------------------------------------------------- trail card copy
  console.log("harvesting trail card copy ...");
  await page.goto(`${ORIGIN}/map`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);
  await dismissPromo(page);
  await page.waitForTimeout(1200);
  await openTrails(page);

  const copy = {};
  const count = await page.evaluate(
    () => [...document.querySelectorAll("button")].filter((b) => (b.textContent || "").replace(/\s+/g, " ").trim() === "Plot on Map").length
  );
  console.log(`  found ${count} trail cards`);
  for (let i = 0; i < count; i++) {
    const data = await page.evaluate((idx) => {
      const txt = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
      const card = (() => {
        const plots = [...document.querySelectorAll("button")].filter((b) => txt(b) === "Plot on Map");
        let c = plots[idx];
        for (let j = 0; j < 8 && c; j++) {
          c = c.parentElement;
          if (!c) break;
          if (/ROUTE DPKR\d+/i.test(txt(c)) && /Start:/.test(txt(c))) break;
        }
        return c;
      })();
      if (!card) return null;
      const routeNo = Number((txt(card).match(/ROUTE DPKR(\d+)/i) || [])[1]);
      const badge = [...card.querySelectorAll("span")].find((s) => /·\s*\d+\s*stops/i.test(txt(s)));
      const title = card.querySelector("h4")?.textContent?.trim() || "";
      const metro = [...card.querySelectorAll("p")].find((p) => /truncate/.test(p.className || ""))?.textContent?.trim() || "";
      const desc = [...card.querySelectorAll("p")].find((p) => /line-clamp-2/.test(p.className || ""))?.textContent?.trim() || "";
      const start = [...card.querySelectorAll("span")].find((s) => /^Start:$/.test(txt(s)))?.nextElementSibling?.textContent?.trim() || "";
      const finish = [...card.querySelectorAll("span")].find((s) => /^Finish:$/.test(txt(s)))?.nextElementSibling?.textContent?.trim() || "";
      const early = [...card.querySelectorAll("strong")].find((s) => /Early exits:/i.test(txt(s)))?.parentElement?.textContent?.trim() || "";
      return { routeNo, zoneStops: txt(badge), title, metro, desc, start, finish, early };
    }, i);
    if (!data?.routeNo) continue;

    await page.evaluate((idx) => {
      const txt = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
      const plots = [...document.querySelectorAll("button")].filter((b) => txt(b) === "Plot on Map");
      let card = plots[idx];
      for (let j = 0; j < 8 && card; j++) {
        card = card.parentElement;
        if (!card) break;
        if (/ROUTE DPKR\d+/i.test(txt(card)) && /Start:/.test(txt(card))) break;
      }
      const b = card && [...card.querySelectorAll("button")].find((x) => /^View trail sections \(\d+\)/i.test(txt(x)));
      b?.click();
    }, i);
    await page.waitForTimeout(140);

    const sections = await page.evaluate((idx) => {
      const txt = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
      const plots = [...document.querySelectorAll("button")].filter((b) => txt(b) === "Plot on Map");
      let card = plots[idx];
      for (let j = 0; j < 8 && card; j++) {
        card = card.parentElement;
        if (!card) break;
        if (/ROUTE DPKR\d+/i.test(txt(card)) && /Start:/.test(txt(card))) break;
      }
      if (!card) return [];
      return [...card.querySelectorAll("p")]
        .filter((p) => /uppercase/.test(p.className || "") && /→/.test(txt(p.nextElementSibling)))
        .map((p) => ({
          title: txt(p),
          stops: txt(p.nextElementSibling).split("→").map((s) => s.trim()).filter(Boolean),
        }));
    }, i);

    await page.evaluate((idx) => {
      const txt = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
      const plots = [...document.querySelectorAll("button")].filter((b) => txt(b) === "Plot on Map");
      let card = plots[idx];
      for (let j = 0; j < 8 && card; j++) {
        card = card.parentElement;
        if (!card) break;
        if (/ROUTE DPKR\d+/i.test(txt(card)) && /Start:/.test(txt(card))) break;
      }
      const b = card && [...card.querySelectorAll("button")].find((x) => /^Hide trail sections/i.test(txt(x)));
      b?.click();
    }, i);
    await page.waitForTimeout(70);

    const [zone, stops] = String(data.zoneStops || "").split("·").map((s) => s.trim());
    copy[data.routeNo] = {
      zone,
      stops: Number((stops || "").replace(/\D/g, "")) || null,
      title: data.title,
      metro: data.metro,
      description: data.desc,
      start: data.start,
      finish: data.finish,
      earlyExits: data.early.replace(/^Early exits:\s*/i, "").trim(),
      sections,
    };
    if (data.routeNo % 5 === 0) console.log(`  copy ${data.routeNo}/30`);
  }
  fs.writeFileSync(path.join(DATA, "map-route-copy.json"), JSON.stringify(copy, null, 2) + "\n");
  console.log(`  ${Object.keys(copy).length} trail cards -> data/map-route-copy.json`);

  // ----------------------------------------------- route geometry + estimates
  console.log("harvesting route geometry + displayed estimates ...");
  const geoPage = await context.newPage();
  const captured = new Map();
  let current = null;
  await geoPage.route("**/map*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    try {
      const resp = await route.fetch();
      const body = await resp.text();
      if (current) captured.set(current, body);
      await route.fulfill({ response: resp, body });
    } catch {
      await route.continue().catch(() => {});
    }
  });

  const geo = {};
  for (const route of routes) {
    const id = route.id;
    current = id;
    captured.delete(id);
    await geoPage.goto(`${ORIGIN}/map?route=${id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await geoPage.waitForTimeout(2200);
    await dismissPromo(geoPage);

    const deadline = Date.now() + 28000;
    while (!captured.has(id) && Date.now() < deadline) await geoPage.waitForTimeout(250);
    await geoPage
      .waitForFunction(
        () => /turn steps|Saves ~|VIA \d+ STOPS/i.test(document.body.innerText),
        { timeout: 20000 }
      )
      .catch(() => {});
    await geoPage.waitForTimeout(500);

    const stats = await geoPage.evaluate(() => {
      const txt = (el) => (el?.innerText || "").replace(/\s+/g, " ").trim();
      const side = [...document.querySelectorAll("div")].find((d) => /w-\[360px\]/.test(d.className || ""));
      const t = txt(side);
      const mode = t.match(/(\d+)\s+Walk\s+((?:\d+h\s*)?\d+m)\s+Drive\s+((?:\d+h\s*)?\d+m)\s+Cycle\s+((?:\d+h\s*)?\d+m)\s+Transit\s+((?:\d+h\s*)?\d+m)/);
      const km = t.match(/(\d+(?:\.\d+)?)\s*km\s*•\s*~?([^()]+)\((Walk|Drive|Cycle|Transit)\)/);
      const turn = t.match(/(\d+)\s*turn steps/);
      const saves = t.match(/Saves ~\s*(\d+)\s*hr\s*(\d+)?\s*min/i);
      const savesMin = t.match(/Saves ~\s*(\d+)\s*min/i);
      const legs = side
        ? [...side.querySelectorAll("a")]
            .filter((a) => /google\.com\/maps/.test(a.href))
            .map((a) => ({ label: (a.textContent || "").replace(/\s+/g, " ").trim(), href: a.href }))
        : [];
      return {
        stopCount: mode ? Number(mode[1]) : null,
        walk: mode?.[2] || null,
        drive: mode?.[3] || null,
        cycle: mode?.[4] || null,
        transit: mode?.[5] || null,
        km: km ? Number(km[1]) : null,
        summaryMode: km?.[3] || null,
        summaryLine: km ? `${km[1]} km • ~${km[2].trim()} (${km[3]})` : "",
        turnSteps: turn ? Number(turn[1]) : null,
        savesSeconds: saves ? Number(saves[1]) * 3600 + Number(saves[2] || 0) * 60 : savesMin ? Number(savesMin[1]) * 60 : null,
        legs,
      };
    });

    let segments = [];
    let distanceM = null;
    let durationS = null;
    let geometrySteps = null;
    const body = captured.get(id);
    if (body) {
      const flight = parseFlight(body);
      if (flight?.routeGeoJson) {
        const coords = collectCoords(flight.routeGeoJson);
        segments.push({ mode: "walk", coords });
        for (const f of flight.routeGeoJson.features || []) {
          for (const seg of f.properties?.segments || []) {
            distanceM = (distanceM || 0) + (seg.distance || 0);
            durationS = (durationS || 0) + (seg.duration || 0);
            geometrySteps = (geometrySteps || 0) + (seg.steps?.length || 0);
          }
        }
      } else if (flight?.legs) {
        for (const leg of flight.legs) {
          const coords = collectCoords(leg.geoJson);
          if (coords.length) segments.push({ mode: leg.mode || "walk", coords, label: leg.label || "" });
        }
        if (flight.totalDistance) distanceM = flight.totalDistance;
        if (flight.totalDuration) durationS = flight.totalDuration;
      }
    }
    const coords = segments.flatMap((s) => s.coords);
    geo[id] = {
      stopCount: stats.stopCount,
      distanceM: distanceM != null ? Math.round(distanceM) : null,
      durationS: durationS != null ? Math.round(durationS) : null,
      km: stats.km,
      summaryMode: stats.summaryMode,
      summaryLine: stats.summaryLine,
      turnSteps: stats.turnSteps ?? geometrySteps,
      savesSeconds: stats.savesSeconds,
      modeTimes: {
        walk: stats.walk,
        drive: stats.drive,
        cycle: stats.cycle,
        transit: stats.transit,
      },
      modeSeconds: {
        walk: secondsFromLabel(stats.walk),
        drive: secondsFromLabel(stats.drive),
        cycle: secondsFromLabel(stats.cycle),
        transit: secondsFromLabel(stats.transit),
      },
      segments,
      coords,
      legs: stats.legs,
    };
    fs.writeFileSync(path.join(PUBLIC, "map-routes-geo.json"), JSON.stringify(geo) + "\n");
    console.log(
      `  ${id}: ${stats.km ?? "?"} km ${stats.summaryMode ?? ""}, ${stats.turnSteps ?? "?"} steps, ` +
        `${coords.length} pts / ${segments.length} seg, walk ${stats.walk ?? "?"}`
    );
  }

  // -------------------------------------------------- /routes like labels
  console.log("harvesting /routes card labels ...");
  const routesPage = await context.newPage();
  await routesPage.goto(`${ORIGIN}/routes`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await routesPage.waitForTimeout(5000);
  await dismissPromo(routesPage);
  await routesPage.waitForTimeout(600);
  const likes = await routesPage.evaluate(() => {
    const txt = (el) => (el?.innerText || "").replace(/\s+/g, " ").trim();
    const out = {};
    for (const a of document.querySelectorAll("a[href*='/map?route=']")) {
      let card = a;
      for (let i = 0; i < 8 && card; i++) {
        card = card.parentElement;
        if (!card) break;
        if (/ROUTE DPKR\d+/i.test(txt(card)) && /View Details/.test(txt(card))) break;
      }
      if (!card) continue;
      const n = Number((txt(card).match(/ROUTE DPKR(\d+)/i) || [])[1]);
      const like = [...card.querySelectorAll("button")].find((b) => /like route/i.test(b.getAttribute("aria-label") || "") || /Like route/i.test(b.getAttribute("title") || ""));
      if (n) out[n] = { likesDisplay: like ? txt(like) : "" };
    }
    return out;
  });
  for (const [n, extra] of Object.entries(likes)) {
    if (copy[n]) Object.assign(copy[n], extra);
  }
  fs.writeFileSync(path.join(DATA, "map-route-copy.json"), JSON.stringify(copy, null, 2) + "\n");
  console.log(`  ${Object.keys(likes).length} like labels`);

  await browser.close();
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
