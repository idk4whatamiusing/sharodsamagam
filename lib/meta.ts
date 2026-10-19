import type { Metadata } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import meta from "../data/meta.json";

/**
 * Per-route page metadata.
 *
 * The mirror is page bodies only - the scrape dropped <head> - so without this
 * every route shares the root layout's single title. That is what a visitor
 * sees in a browser tab, what a bookmark saves, and what a WhatsApp or
 * Facebook preview shows, which for a festival site is how most people first
 * meet the page.
 *
 * Titles and descriptions come from data/meta.json, harvested from the
 * original by scripts/harvest-meta.mjs, so they are its own words rather than
 * invented ones. Two things are ours rather than theirs: the site name, and
 * any image that cannot be served from this origin.
 *
 * Server-only: it reads data/ and the filesystem during prerender.
 */

type RouteMeta = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogLocale: string;
};

const ROUTES = meta.routes as Record<string, RouteMeta>;

const SITE_NAME = "Sharodsamagam";

/** The share card used whenever a harvested image is not one we can serve. */
const FALLBACK_IMAGE = "/og-image.png";

/**
 * The original has no /home URL - our mirror's home.html is a second copy of
 * the index page, so it borrows the index metadata rather than going without.
 */
const ALIASES: Record<string, string> = { home: "index" };

export function routeMeta(rel: string): RouteMeta | null {
  return ROUTES[rel] ?? ROUTES[ALIASES[rel]] ?? null;
}

/**
 * Several routes point their social card at the original's image proxy
 * (/api/r2-image/...), which needs a server we do not have. Those images are
 * not in the mirror either, so the page falls back to the site card instead of
 * advertising a URL that answers 404.
 */
function servableImage(candidate: string): string {
  if (!candidate) return FALLBACK_IMAGE;
  if (!candidate.startsWith("/")) return FALLBACK_IMAGE;
  return existsSync(path.join(process.cwd(), "public", candidate)) ? candidate : FALLBACK_IMAGE;
}

/** The absolute URL of a route, matching the trailingSlash the site is built with. */
function routePath(rel: string): string {
  return rel === "index" ? "/" : `/${rel}/`;
}

export function metadataForRoute(rel: string): Metadata {
  const m = routeMeta(rel);
  if (!m) return {};

  const title = m.ogTitle || m.title;
  const description = m.ogDescription || m.description;
  const image = servableImage(m.ogImage);

  return {
    title: m.title,
    description: m.description,
    openGraph: {
      title,
      description,
      url: routePath(rel),
      siteName: SITE_NAME,
      locale: m.ogLocale || "en_IN",
      type: "website",
      // No width/height: the harvested images are not all the same size, and a
      // wrong declaration is worse than none - crawlers read the file.
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
