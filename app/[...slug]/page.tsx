import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { mirrorHtml, listRoutes } from "../../lib/mirror";
import { metadataForRoute } from "../../lib/meta";
import { injectMetroMap } from "../../lib/metroInject";
import { injectParasListing } from "../../lib/parasInject";

// Every mirror route is known at build time, so nothing is rendered on demand.
export const dynamicParams = false;

export function generateStaticParams() {
  return listRoutes()
    .filter((r) => r !== "index" && !r.startsWith("_"))
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
