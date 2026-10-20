#!/usr/bin/env node
/**
 * Serves the static export for local verification, with a mock of the
 * Worker's API.
 *
 * The real API lives in the Cloudflare Worker (Google OAuth, D1, KV, Workers
 * AI). A plain static server cannot answer /api/*, so the browser would log a
 * 404 on every page and the verification suite could not exercise the
 * account features at all.
 *
 * The mock implements the same contract with an in-memory store:
 *
 *   GET  /api/me       -> { user } (signed out unless the ss_mock_user cookie
 *                         names a user)
 *   GET  /api/saves    -> the signed-in user's save sets
 *   POST /api/saves    -> toggles one item
 *   POST /api/plan     -> a canned plan over real pandal slugs
 *   POST /api/uploads  -> 401 (no blob storage here)
 *
 * Usage: node scripts/serve-static.mjs [port] [dir]
 */

import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const ROOT = path.resolve(process.argv[3] || "out");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".webmanifest": "application/manifest+json",
};

const stores = new Map();

const COOKIE_USER = /ss_mock_user=([^;]+)/;

function readUser(req) {
  const header = req.headers.cookie || "";
  const match = header.match(COOKIE_USER);
  if (!match || match[1] === "off") return null;
  const id = decodeURIComponent(match[1]);
  return { id, email: `${id}@example.com`, name: id, picture: "" };
}

function userKey(req) {
  const header = req.headers.cookie || "";
  const match = header.match(COOKIE_USER);
  return match && match[1] !== "off" ? decodeURIComponent(match[1]) : null;
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function planFor(message) {
  const slugs = [
    "tridhara",
    "ballygunge-cultural-association",
    "sammilani",
    "deshapriya-park-sarbojanin-durgotsab",
    "sherawali-para-sarbojanin-durgotsab",
  ];
  const stops = slugs.map((slug, index) => ({
    id: slug,
    name: slug.replace(/-/g, " "),
    kind: "pandal",
    lat: 22.51 + index * 0.004,
    lng: 88.34 + index * 0.004,
    zone: "south",
    locality: "Kolkata",
  }));
  return {
    reply: `Here is a ${stops.length}-stop plan for "${message}".`,
    clarify: null,
    notes: "Peak crowds arrive after 7 PM.",
    mode: "walk",
    stops,
    meetingPoint: null,
    ai: true,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/me" && req.method === "GET") {
    json(res, { user: readUser(req) });
    return;
  }

  if (url.pathname === "/api/saves") {
    const key = userKey(req);
    if (!key) {
      json(res, { error: "not_signed_in" }, 401);
      return;
    }
    // A fresh copy per user: a shallow spread would share the empty arrays
    // between accounts, so one user's save would leak into the next.
    const saves = stores.get(key) || {
      pandals: [],
      trails: [],
      routes: [],
      liked: [],
    };
    if (req.method === "GET") {
      json(res, saves);
      return;
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const bucket = { pandal: "pandals", trail: "trails", route: "routes", liked: "liked" }[body.kind];
      if (!bucket) {
        json(res, { error: "bad_kind" }, 400);
        return;
      }
      const value = body.value != null ? String(body.value) : String(body.id);
      const list = saves[bucket];
      const at = list.indexOf(value);
      if (at === -1) list.push(value);
      else list.splice(at, 1);
      stores.set(key, saves);
      json(res, { saved: at === -1, saves });
      return;
    }
  }

  if (url.pathname === "/api/plan" && req.method === "POST") {
    const key = userKey(req);
    if (!key) {
      json(res, { error: "not_signed_in" }, 401);
      return;
    }
    const body = await readBody(req);
    json(res, planFor(String(body.message || "your trip")));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    json(res, { error: "not_found" }, 404);
    return;
  }

  // ---- static files ------------------------------------------------------
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  let file = path.join(ROOT, pathname);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  // The export serves every page as <route>/index.html, and Cloudflare
  // redirects the extensionless form to the trailing-slash one. The mock
  // answers the extensionless form directly so link checks that follow a
  // redirect still resolve.
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, "index.html");
  }
  if (!fs.existsSync(file) && !path.extname(pathname)) {
    const candidate = path.join(ROOT, pathname, "index.html");
    if (fs.existsSync(candidate)) file = candidate;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const fallback = path.join(ROOT, "404.html");
    if (fs.existsSync(fallback)) {
      const html = fs.readFileSync(fallback);
      res.writeHead(404, { "content-type": MIME[".html"] }).end(html);
      return;
    }
    res.writeHead(404).end("Not found");
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const data = fs.readFileSync(file);
  res.writeHead(200, {
    "content-type": MIME[ext] || "application/octet-stream",
    "content-length": data.length,
    "cache-control": ext === ".html" ? "no-store" : "public, max-age=3600",
  });
  res.end(data);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`serving ${ROOT} with a mock API on http://127.0.0.1:${PORT}`);
});
