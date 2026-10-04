import fs from "fs";
import path from "path";
import { mirrorHtml, listRoutes } from "../../lib/mirror";

export function generateStaticParams() {
  return listRoutes()
    .filter((r) => r !== "index" && !r.startsWith("_"))
    .map((r) => ({ slug: r.split("/") }));
}

export default async function MirrorPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const rel = slug.join("/");
  let html = mirrorHtml(rel);
  if (!html) return <div>Not found: {rel}</div>;
  if (rel === "map") {
    html = html.replace(
      /<div class="w-full h-full bg-\[#FFFBF0\][\s\S]*?<\/div><!--\/\$-->/,
      '<div id="kolkata-map" style="width:100%;height:70vh;min-height:450px"></div><!--/$-->'
    );
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
