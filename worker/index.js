/**
 * Sharodsamagam Worker.
 *
 * The site itself is a static Next.js export; this Worker sits in front of it
 * and adds the things a static site cannot do:
 *
 *   /auth/google      Google OAuth (PKCE) sign-in
 *   /auth/logout      sign out
 *   /api/me           the signed-in user
 *   /api/saves        saved pandals / trails / routes / liked routes (D1 + KV)
 *   /api/suggestions  "Suggest Missing Pandal" (D1)
 *   /api/uploads      pandal photo uploads (D1 BLOB)
 *   /media/<id>       uploaded photos
 *   /api/photos       approved photos for a pandal
 *   /api/plan         the AI trip planner (Workers AI + KV cache)
 *
 * Everything else falls through to the static assets, so the site's routing,
 * trailing-slash behaviour and 404 page are unchanged.
 *
 * The browser only ever holds one cookie: `ss_session`, the session id
 * encrypted with AES-256-GCM using the SESSION_KEY secret. The plaintext
 * session id never leaves the Worker.
 */

const SESSION_COOKIE = "ss_session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
const SAVES_TTL = 300; // 5 minutes
const PLAN_TTL = 3600; // 1 hour
const MAX_IMAGE_BYTES = 1024 * 1024; // 1 MB

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

/* ------------------------------------------------------------------ utils */

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });

const b64url = (bytes) => {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromB64url = (value) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

async function aesKey(secret) {
  const raw = secret.trim();
  // Accept base64 (32 bytes) or a raw passphrase (hashed to 32 bytes).
  const bytes = /^[A-Za-z0-9+/=_-]{40,}$/.test(raw)
    ? fromB64url(raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""))
    : new TextEncoder().encode(raw);
  const material = bytes.length === 32 ? bytes : new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(value, secret) {
  const key = await aesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  const out = new Uint8Array(iv.length + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.length);
  return b64url(out);
}

async function decrypt(value, secret) {
  try {
    const key = await aesKey(secret);
    const bytes = fromB64url(value);
    const iv = bytes.slice(0, 12);
    const cipher = bytes.slice(12);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const out = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function cookieHeader(value, maxAge) {
  const bits = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  return bits.join("; ");
}

const now = () => Date.now();

/* --------------------------------------------------------------- session */

/** Reads the encrypted cookie and returns the live session from KV. */
async function readSession(request, env) {
  if (!env.SESSION_KEY) return null;
  const raw = parseCookies(request)[SESSION_COOKIE];
  if (!raw) return null;
  const sessionId = await decrypt(raw, env.SESSION_KEY);
  if (!sessionId) return null;
  const record = await env.CACHE.get(`sess:${sessionId}`, "json");
  if (!record) return null;
  if (record.exp && record.exp < now()) {
    await env.CACHE.delete(`sess:${sessionId}`);
    return null;
  }
  return { id: sessionId, ...record };
}

async function writeSession(env, user) {
  const sessionId = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await env.CACHE.put(
    `sess:${sessionId}`,
    JSON.stringify({
      uid: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      exp: now() + SESSION_TTL * 1000,
    }),
    { expirationTtl: SESSION_TTL }
  );
  return sessionId;
}

async function requireSession(request, env) {
  const session = await readSession(request, env);
  if (!session) return { error: json({ error: "not_signed_in" }, 401) };
  return { session };
}

/* ------------------------------------------------------------------- D1 */

async function d1(env, sql, ...params) {
  const statement = env.DB.prepare(sql);
  if (params.length) statement.bind(...params);
  const result = await statement.first();
  return result;
}

async function d1All(env, sql, ...params) {
  const statement = env.DB.prepare(sql);
  if (params.length) statement.bind(...params);
  const { results } = await statement.all();
  return results || [];
}

async function d1Run(env, sql, ...params) {
  const statement = env.DB.prepare(sql);
  if (params.length) statement.bind(...params);
  return statement.run();
}

/* ------------------------------------------------------------------ saves */

const SAVE_KINDS = {
  pandal: { table: "saved_pandals", column: "slug" },
  trail: { table: "saved_trails", column: "route_id" },
  route: { table: "saved_routes", column: "route_key" },
  liked: { table: "liked_routes", column: "route_number" },
};

async function loadSaves(env, uid) {
  const cached = await env.CACHE.get(`u:${uid}:saves`, "json");
  if (cached) return cached;
  const [pandals, trails, routes, liked] = await Promise.all([
    d1All(env, "SELECT slug FROM saved_pandals WHERE user_id = ?", uid),
    d1All(env, "SELECT route_id FROM saved_trails WHERE user_id = ?", uid),
    d1All(env, "SELECT route_key FROM saved_routes WHERE user_id = ?", uid),
    d1All(env, "SELECT route_number FROM liked_routes WHERE user_id = ?", uid),
  ]);
  const saves = {
    pandals: pandals.map((r) => r.slug),
    trails: trails.map((r) => r.route_id),
    routes: routes.map((r) => r.route_key),
    liked: liked.map((r) => r.route_number),
  };
  await env.CACHE.put(`u:${uid}:saves`, JSON.stringify(saves), { expirationTtl: SAVES_TTL });
  return saves;
}

async function toggleSave(env, uid, kind, id, payload) {
  const spec = SAVE_KINDS[kind];
  if (!spec) return null;
  const value = payload == null ? id : String(payload);
  const existing = await d1(
    env,
    `SELECT 1 AS found FROM ${spec.table} WHERE user_id = ? AND ${spec.column} = ?`,
    uid,
    value
  );
  if (existing) {
    await d1Run(
      env,
      `DELETE FROM ${spec.table} WHERE user_id = ? AND ${spec.column} = ?`,
      uid,
      value
    );
  } else {
    await d1Run(
      env,
      `INSERT OR IGNORE INTO ${spec.table} (user_id, ${spec.column}, created_at) VALUES (?, ?, ?)`,
      uid,
      value,
      now()
    );
  }
  await env.CACHE.delete(`u:${uid}:saves`);
  return { saved: !existing, saves: await loadSaves(env, uid) };
}

/* ------------------------------------------------------------------- AI */

const ZONE_WORDS = [
  ["north", "north"],
  ["south", "south"],
  ["central", "central"],
  ["east", "east"],
  ["howrah", "howrah"],
  ["salt lake", "east"],
  ["tollygunge", "south"],
  ["gariahat", "south"],
  ["garia", "south"],
  ["ballygunge", "south"],
  ["kalighat", "south"],
  ["park street", "central"],
  ["esplanade", "central"],
  ["shyambazar", "north"],
  ["shobhabazar", "north"],
  ["dum dum", "north"],
  ["ballygunge", "south"],
  ["behala", "south"],
  ["tala", "north"],
  ["bhowanipore", "south"],
  ["entally", "central"],
  ["beliaghata", "east"],
  ["new town", "east"],
  ["Ultadanga", "north"],
  ["bhowanagar", "east"],
  ["dhakuria", "south"],
  ["golf green", "south"],
  ["barasat", "north"],
  ["howrah bridge", "howrah"],
  ["dakshineswar", "north"],
  ["esplanade metro", "central"],
];

const THEME_WORDS = [
  ["heritage", "heritage"],
  ["bonedi", "heritage"],
  ["old", "heritage"],
  ["traditional", "traditional"],
  ["authentic", "traditional"],
  ["lighting", "lighting"],
  ["light", "lighting"],
  ["art", "lighting"],
  ["theme", "theme"],
  ["theme-based", "theme"],
  ["award", "award"],
  ["famous", "award"],
  ["instagram", "award"],
  ["photography", "award"],
  ["food", "food"],
  ["bhog", "food"],
  ["chai", "food"],
  ["snack", "food"],
  ["quiet", "quiet"],
  ["less crowded", "quiet"],
  ["not crowded", "quiet"],
  ["avoid crowd", "quiet"],
  ["family", "family"],
  ["kids", "family"],
];

function detectZone(text) {
  const lower = text.toLowerCase();
  for (const [word, zone] of ZONE_WORDS) {
    if (lower.includes(word)) return zone;
  }
  return null;
}

function detectThemes(text) {
  const lower = text.toLowerCase();
  const themes = new Set();
  for (const [word, theme] of THEME_WORDS) {
    if (lower.includes(word)) themes.add(theme);
  }
  return [...themes];
}

function detectDuration(text) {
  const lower = text.toLowerCase();
  const hours = lower.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr|h\b)/);
  if (hours) return Math.max(1, Math.min(8, Number(hours[1]))) * 60;
  if (lower.includes("half day")) return 300;
  if (lower.includes("full day") || lower.includes("whole day")) return 480;
  if (lower.includes("morning")) return 180;
  if (lower.includes("evening")) return 240;
  if (lower.includes("quick") || lower.includes("short")) return 90;
  return null;
}

function detectMode(text) {
  const lower = text.toLowerCase();
  if (lower.includes("walk") || lower.includes("walking") || lower.includes("on foot")) return "walk";
  if (lower.includes("cycle") || lower.includes("cycling") || lower.includes("bike")) return "cycle";
  if (lower.includes("metro") || lower.includes("subway")) return "transit";
  if (lower.includes("drive") || lower.includes("car") || lower.includes("taxi") || lower.includes("auto")) return "drive";
  return null;
}

const STOP_CATEGORIES = {
  lighting: ["famous-for-lighting", "theme-based", "award-winner"],
  heritage: ["historical", "traditional", "award-winner"],
  traditional: ["traditional", "historical"],
  theme: ["theme-based"],
  award: ["award-winner"],
  quiet: ["community-favorite", "traditional"],
  family: ["community-favorite", "award-winner"],
  food: ["community-favorite", "award-winner"],
};

/** Builds the candidate list the model is allowed to choose from. */
function buildCandidates(pandals, pois, message, limit) {
  const zone = detectZone(message);
  const themes = detectThemes(message);
  const lower = message.toLowerCase();
  const wanted = new Set();
  for (const theme of themes) for (const tag of STOP_CATEGORIES[theme] || []) wanted.add(tag);

  const scored = [];
  for (const pandal of pandals) {
    let score = 0;
    if (zone && pandal.zone === zone) score += 6;
    for (const tag of pandal.categories || []) if (wanted.has(tag)) score += 4;
    if (pandal.featured) score += 2;
    if (pandal.rating) score += Math.min(2, pandal.rating / 2.5);
    if (pandal.established && pandal.established < 1951) score += 1;
    const hay = `${pandal.name} ${pandal.locality} ${pandal.metro || ""}`.toLowerCase();
    for (const word of lower.split(/[^a-z]+/)) {
      if (word.length > 4 && hay.includes(word)) score += 1;
    }
    scored.push({ kind: "pandal", id: pandal.slug, name: pandal.name, zone: pandal.zone, score });
  }

  for (const poi of pois) {
    if (poi.category === "metro-station" || poi.category === "railway-station" || poi.category === "ferry-ghat") {
      let score = zone ? 2 : 1;
      const hay = poi.name.toLowerCase();
      for (const word of lower.split(/[^a-z]+/)) {
        if (word.length > 4 && hay.includes(word)) score += 3;
      }
      scored.push({ kind: "poi", id: poi.id, name: poi.name, zone: "", score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit);
}

function buildPrompt(message, candidates, context) {
  const list = candidates
    .map(
      (c, i) =>
        `${i + 1}. [${c.id}] ${c.name} (${c.kind}${c.zone ? ", " + c.zone : ""})`
    )
    .join("\n");
  const lines = [
    "You plan Durga Puja trips in Kolkata using ONLY the numbered list below.",
    "Reply with a single JSON object and nothing else.",
    "Schema:",
    '{"reply": string, "clarify": string|null, "meetingPoint": string|null, "stops": number[], "mode": "walk"|"drive"|"cycle"|"transit", "notes": string}',
    "",
    "Rules:",
    "- reply: one friendly sentence describing the plan you made, using the real names.",
    "- clarify: set ONLY if the request is too vague to plan (no area, no time, no theme). Otherwise null.",
    "- meetingPoint: the id of a landmark or transit hub to meet at, or null.",
    "- stops: the ids of the pandals to visit, in visiting order. 3-8 stops.",
    "- mode: the travel mode for the whole trip.",
    "- notes: one short tip, e.g. about crowds or best time of day.",
    "",
    "Candidate list:",
    list,
  ];
  if (context?.origin) lines.push("", "The user starts near: " + context.origin);
  if (context?.location) {
    lines.push(
      "",
      `The user is currently at lat ${context.location.lat}, lng ${context.location.lng}.`
    );
  }
  lines.push("", "User message: " + message);
  return lines.join("\n");
}

function parseModelJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Heuristic plan used when the model is unavailable. */
function heuristicPlan(message, candidates) {
  const pandals = candidates.filter((c) => c.kind === "pandal").slice(0, 5);
  const mode = detectMode(message) || "walk";
  const zone = detectZone(message);
  const places = pandals.length ? pandals : candidates.slice(0, 4);
  return {
    reply: places.length
      ? `Here is a ${mode} plan through ${places.length} pandals${zone ? " in " + zone : ""}.`
      : "I could not find matching pandals for that request.",
    clarify: null,
    meetingPoint: null,
    stops: places.map((c) => c.id),
    mode,
    notes: "Plan generated from the pandal directory.",
  };
}

async function runAi(env, message, candidates, context) {
  if (!env.AI) return { plan: heuristicPlan(message, candidates), ai: false };
  try {
    const response = await env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content:
            "You are the Sharodsamagam trip planner for Kolkata Durga Puja. You only ever recommend the numbered candidates you are given.",
        },
        { role: "user", content: buildPrompt(message, candidates, context) },
      ],
      max_tokens: 700,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });
    const content = response?.response || response?.choices?.[0]?.message?.content || "";
    const plan = parseModelJson(typeof content === "string" ? content : JSON.stringify(content));
    if (!plan || !Array.isArray(plan.stops)) {
      return { plan: heuristicPlan(message, candidates), ai: false };
    }
    return { plan, ai: true };
  } catch {
    return { plan: heuristicPlan(message, candidates), ai: false };
  }
}

async function handlePlan(request, env) {
  const auth = await requireSession(request, env);
  if (auth.error) return auth.error;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const message = String(body.message || "").trim();
  if (!message) return json({ error: "empty_message" }, 400);

  const cacheKey = `plan:${b64url(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        `${auth.session.uid}|${body.mode || ""}|${message.toLowerCase()}|${body.location?.lat || ""},${body.location?.lng || ""}`
      )
    )
  )}`;

  const cached = await env.CACHE.get(cacheKey, "json");
  if (cached) return json({ ...cached, cached: true });

  const source = await loadDirectory(env);
  const poiSource = source.pois || [];
  const candidates = buildCandidates(source.pandals || [], poiSource, message, 50);

  const { plan, ai } = await runAi(env, message, candidates, {
    origin: body.origin || null,
    location: body.location || null,
  });

  const validIds = new Set(candidates.map((c) => c.id));
  const stops = (plan.stops || []).filter((id) => validIds.has(id)).slice(0, 8);
  const resolved = stops.map((id) => {
    const candidate = candidates.find((c) => c.id === id);
    const poi = poiSource.find((p) => p.id === id);
    const pandal = (source.pandals || []).find((p) => p.slug === id);
    return {
      id,
      name: candidate?.name || poi?.name || pandal?.name || id,
      kind: candidate?.kind || (poi ? "poi" : "pandal"),
      lat: poi?.lat ?? pandal?.lat ?? null,
      lng: poi?.lng ?? pandal?.lng ?? null,
      zone: candidate?.zone || pandal?.zone || "",
      locality: pandal?.locality || poi?.address || "",
    };
  });

  const meetingPoint = plan.meetingPoint && validIds.has(plan.meetingPoint)
    ? resolved.find((r) => r.id === plan.meetingPoint) || null
    : null;

  const payload = {
    reply: plan.reply || "Here is a plan for you.",
    clarify: plan.clarify || null,
    notes: plan.notes || "",
    mode: ["walk", "drive", "cycle", "transit"].includes(plan.mode) ? plan.mode : "walk",
    stops: resolved,
    meetingPoint,
    ai,
  };

  await env.CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: PLAN_TTL });
  await d1Run(
    env,
    "INSERT INTO trips (user_id, plan_json, meeting_point, created_at) VALUES (?, ?, ?, ?)",
    auth.session.uid,
    JSON.stringify(payload),
    meetingPoint?.name || null,
    now()
  ).catch(() => {});

  return json(payload);
}

/**
 * The pandal and POI directories, trimmed to the fields the planner needs.
 * They ship as static assets, so they are read through the asset binding and
 * kept in the isolate's memory for the life of the isolate - no KV write, no
 * database read, and the same data the site renders.
 */
let directoryCache = null;

async function loadDirectory(env) {
  if (directoryCache) return directoryCache;
  const empty = { pandals: [], pois: [] };
  try {
    const [pandalsRes, poisRes] = await Promise.all([
      env.ASSETS.fetch(new URL("https://assets.local/map/pandals.json")),
      env.ASSETS.fetch(new URL("https://assets.local/map/pois.json")),
    ]);
    const rawPandals = pandalsRes.ok ? await pandalsRes.json() : [];
    const rawPois = poisRes.ok ? await poisRes.json() : [];
    const pandals = rawPandals.map((p) => ({
      slug: p.slug,
      name: p.name,
      zone: p.zone,
      locality: p.locality,
      categories: p.categories || [],
      rating: p.rating,
      established: p.established,
      featured: p.featured,
      lat: p.lat,
      lng: p.lng,
    }));
    const pois = rawPois.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      lat: p.lat,
      lng: p.lng,
      address: p.address,
    }));
    directoryCache = { pandals, pois };
  } catch {
    directoryCache = empty;
  }
  return directoryCache;
}

/* ----------------------------------------------------------------- auth */

async function handleGoogleStart(request, env, url) {
  if (!env.GOOGLE_CLIENT_ID) {
    return json({ error: "google_not_configured" }, 503);
  }
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  );
  await env.CACHE.put(`pkce:${state}`, JSON.stringify({ verifier }), { expirationTtl: 600 });

  const redirectUri = `${url.origin}/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "select_account",
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}

async function handleGoogleCallback(request, env, url) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({ error: "google_not_configured" }, 503);
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return json({ error: "bad_request" }, 400);

  const pkce = await env.CACHE.get(`pkce:${state}`, "json");
  if (!pkce) return json({ error: "state_expired" }, 400);
  await env.CACHE.delete(`pkce:${state}`);

  const redirectUri = `${url.origin}/auth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: pkce.verifier,
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok || !tokens.access_token) {
    return json({ error: "token_exchange_failed" }, 400);
  }

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const info = await infoRes.json();
  if (!infoRes.ok || !info.sub) return json({ error: "profile_failed" }, 400);

  const user = {
    id: info.sub,
    email: info.email || "",
    name: info.name || info.email || "Puja pilgrim",
    picture: info.picture || "",
  };

  await d1Run(
    env,
    `INSERT INTO users (id, google_id, email, name, picture, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name,
       picture = excluded.picture, last_seen_at = excluded.last_seen_at`,
    user.id,
    user.id,
    user.email,
    user.name,
    user.picture,
    now(),
    now()
  ).catch(() => {});

  if (tokens.refresh_token) {
    await d1Run(
      env,
      `INSERT INTO oauth_tokens (user_id, refresh_token, expires_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at`,
      user.id,
      tokens.refresh_token,
      now() + (tokens.expires_in || 3600) * 1000
    ).catch(() => {});
  }

  const sessionId = await writeSession(env, user);
  const encrypted = await encrypt(sessionId, env.SESSION_KEY);
  const target = url.searchParams.get("next") || "/map";
  return new Response(null, {
    status: 302,
    headers: {
      location: target.startsWith("/") ? target : "/map",
      "set-cookie": cookieHeader(encrypted, SESSION_TTL),
      "cache-control": "no-store",
    },
  });
}

/* --------------------------------------------------------------- uploads */

async function handleUpload(request, env) {
  const auth = await requireSession(request, env);
  if (auth.error) return auth.error;

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "bad_form" }, 400);
  }
  const file = form.get("file");
  const pandal = String(form.get("pandal") || "").trim();
  const caption = String(form.get("caption") || "").trim();
  if (!file || typeof file.arrayBuffer !== "function") {
    return json({ error: "no_file" }, 400);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return json({ error: "too_large", max: MAX_IMAGE_BYTES }, 413);
  }
  const buffer = await file.arrayBuffer();
  const type = String(file.type || "image/jpeg");
  if (!type.startsWith("image/")) return json({ error: "not_an_image" }, 415);

  const id = b64url(crypto.getRandomValues(new Uint8Array(12)));
  await d1Run(
    env,
    `INSERT INTO photos (id, user_id, pandal_slug, caption, mime, data, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    id,
    auth.session.uid,
    pandal,
    caption,
    type,
    buffer,
    now()
  );
  return json({ ok: true, id, status: "pending" });
}

async function handleMedia(request, env, url) {
  const id = url.pathname.slice("/media/".length);
  if (!id) return new Response("Not found", { status: 404 });
  const row = await d1(env, "SELECT mime, data, status FROM photos WHERE id = ?", id);
  if (!row || !row.data) return new Response("Not found", { status: 404 });
  if (row.status !== "approved") {
    const session = await readSession(request, env);
    if (!session || session.uid !== (await ownerOf(env, id))) {
      return new Response("Not found", { status: 404 });
    }
  }
  return new Response(row.data, {
    headers: {
      "content-type": row.mime || "image/jpeg",
      "cache-control": "public, max-age=86400",
    },
  });
}

async function ownerOf(env, id) {
  const row = await d1(env, "SELECT user_id FROM photos WHERE id = ?", id);
  return row?.user_id || "";
}

/* ---------------------------------------------------------------- router */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/auth/google" && request.method === "GET") {
        return await handleGoogleStart(request, env, url);
      }
      if (url.pathname === "/auth/google/callback" && request.method === "GET") {
        return await handleGoogleCallback(request, env, url);
      }
      if (url.pathname === "/auth/logout" && request.method === "POST") {
        const session = await readSession(request, env);
        if (session) await env.CACHE.delete(`sess:${session.id}`);
        return json({ ok: true }, 200, { "set-cookie": cookieHeader("", 0) });
      }

      if (url.pathname === "/api/me" && request.method === "GET") {
        const session = await readSession(request, env);
        if (!session) return json({ user: null });
        return json({
          user: {
            id: session.uid,
            email: session.email,
            name: session.name,
            picture: session.picture,
          },
        });
      }

      if (url.pathname === "/api/saves" && request.method === "GET") {
        const auth = await requireSession(request, env);
        if (auth.error) return auth.error;
        return json(await loadSaves(env, auth.session.uid));
      }

      if (url.pathname === "/api/saves" && request.method === "POST") {
        const auth = await requireSession(request, env);
        if (auth.error) return auth.error;
        let body = {};
        try {
          body = await request.json();
        } catch {
          return json({ error: "bad_request" }, 400);
        }
        const result = await toggleSave(
          env,
          auth.session.uid,
          String(body.kind || ""),
          String(body.id || ""),
          body.value
        );
        if (!result) return json({ error: "bad_kind" }, 400);
        return json(result);
      }

      if (url.pathname === "/api/suggestions" && request.method === "POST") {
        const auth = await requireSession(request, env);
        if (auth.error) return auth.error;
        let body = {};
        try {
          body = await request.json();
        } catch {
          return json({ error: "bad_request" }, 400);
        }
        const name = String(body.name || "").trim();
        const locality = String(body.locality || "").trim();
        if (!name) return json({ error: "name_required" }, 400);
        const id = b64url(crypto.getRandomValues(new Uint8Array(12)));
        await d1Run(
          env,
          `INSERT INTO suggestions (id, user_id, name, locality, lat, lng, note, photo_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
          id,
          auth.session.uid,
          name,
          locality,
          body.lat ?? null,
          body.lng ?? null,
          String(body.note || "").trim(),
          body.photoId || null,
          now()
        );
        return json({ ok: true, id, status: "pending" });
      }

      if (url.pathname === "/api/uploads" && request.method === "POST") {
        return await handleUpload(request, env);
      }

      if (url.pathname === "/api/photos" && request.method === "GET") {
        const pandal = url.searchParams.get("pandal") || "";
        if (!pandal) return json({ photos: [] });
        const rows = await d1All(
          env,
          "SELECT id, caption, created_at FROM photos WHERE pandal_slug = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 60",
          pandal
        );
        return json({ photos: rows.map((r) => ({ id: r.id, caption: r.caption })) });
      }

      if (url.pathname === "/api/plan" && request.method === "POST") {
        return await handlePlan(request, env);
      }

      if (url.pathname.startsWith("/media/") && request.method === "GET") {
        return await handleMedia(request, env, url);
      }

      if (url.pathname.startsWith("/api/")) {
        return json({ error: "not_found" }, 404);
      }
    } catch (error) {
      return json({ error: "server_error", detail: String(error && error.message) }, 500);
    }

    // Everything else is the static site.
    return env.ASSETS.fetch(request);
  },
};
