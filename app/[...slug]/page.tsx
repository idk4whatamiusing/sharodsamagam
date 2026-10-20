import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { mirrorHtml, listRoutes } from "../../lib/mirror";
import { metadataForRoute } from "../../lib/meta";
import { injectMetroMap } from "../../lib/metroInject";
import { injectAboutJourney } from "../../lib/aboutInject";
import { injectGuideTabs } from "../../lib/guideInject";
import { injectEdenLive } from "../../lib/edenInject";
import { injectParasListing } from "../../lib/parasInject";
import { injectPoiDirectory } from "../../lib/poiInject";

// Every mirror route is known at build time, so nothing is rendered on demand.
export const dynamicParams = false;

export function generateStaticParams() {
  return listRoutes()
    .filter((r) => r !== "index" && !r.startsWith("_") && r !== "map" && r !== "routes")
    .map((r) => ({ slug: r.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return metadataForRoute(slug.join("/"));
}

export default async function MirrorPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const rel = slug.join("/");
  let html = mirrorHtml(rel);
  if (!html) return <div>Not found: {rel}</div>;
  // The guide's transit map is a never-resolving loading skeleton in the
  // mirror. Swap it for a slot on any guide page; pages without one are
  // returned untouched by the injector.
  if (rel === "guide" || rel.startsWith("guide/")) {
    html = injectMetroMap(html);
    if (rel === "guide") {
      // The topic pills are dead buttons in the scrape; tag them and graft in
      // the four panels components/GuideTabs.tsx swaps between.
      html = injectGuideTabs(html);
    }
  }
  if (rel === "eden-gardens-live") {
    // The broadcast replay's Theater Mode and Share controls are client-side
    // on the original; tag them for components/EdenLive.tsx.
    html = injectEdenLive(html);
  }
  if (rel === "about-us") {
    // The Ritual Journey day tabs are dead buttons in the scrape; tag them so
    // components/AboutJourney.tsx can swap the panels from data/about-days.json.
    html = injectAboutJourney(html);
  }
  if (rel === "points-of-interest") {
    // The directory's search box and chips have no server-side behaviour, and
    // the scrape only kept 119 of the 273 places; rebuild from data/pois.json.
    html = injectPoiDirectory(html);
  }
  if (rel === "map") {
    html = html.replace(
      /<div class="w-full h-full bg-\[#FFFBF0\][\s\S]*?Loading Kolkata Map\.\.\.<\/p><\/div>/,
      '<div id="kolkata-map" style="width:100%;height:70vh;min-height:450px"></div>'
    );
  } else if (rel === "paras") {
    // The listing shipped 24 cards and a dead scroll sentinel. Replace it
    // with a slot the client fills from public/paras.json.
    const cards = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", "paras.json"), "utf8")
    ) as unknown[];
    const shown = (html.match(/<a class="block h-full" href="\/paras\//g) || []).length;
    html = injectParasListing(html, cards.length, shown);
  } else if (rel.startsWith("paras/")) {
    const slug = rel.slice("paras/".length);
    const pandals = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "pandals.json"), "utf8")
    );
    const p = pandals.find((x: { slug: string }) => x.slug === slug);
    if (p && p.lat != null && p.lng != null) {
      html = html.replace(
        /<div class="w-full h-full min-h-\[90px\][^>]*>Loading map\.\.\.<\/div>/,
        `<div id="pandal-map" data-lat="${p.lat}" data-lng="${p.lng}" style="width:100%;height:100%;min-height:90px"></div>`
      );
    }
  }
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
