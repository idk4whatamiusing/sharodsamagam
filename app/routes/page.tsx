import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import RoutesBoard from "../../components/routes/RoutesBoard";
import type { CuratedRoute, Pandal, RouteCopy } from "../../components/map/types";

export const metadata: Metadata = {
  title: "Curated Pujo Parikrama Routes 2026 | Sharodsamagam",
  description:
    "30 handcrafted Durga Puja walking, transit and heritage circuits across Kolkata, with verified stops, metro arrivals and interactive map links.",
  openGraph: {
    title: "Curated Pujo Parikrama Routes 2026",
    description:
      "30 handcrafted Durga Puja circuits across Kolkata with verified stops and interactive map links.",
    type: "website",
  },
};

type StopMeta = { categories: string[]; metro: string; zone: string };

export default function RoutesPage() {
  const routes = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public", "map", "routes.json"), "utf8")
  ) as CuratedRoute[];
  const copy = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public", "map", "route-copy.json"), "utf8")
  ) as Record<string, RouteCopy>;
  const pandals = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public", "map", "pandals.json"), "utf8")
  ) as Pandal[];

  const stopNames = new Set<string>();
  for (const route of routes) {
    if (route.start) stopNames.add(route.start.name);
    if (route.end) stopNames.add(route.end.name);
    for (const waypoint of route.waypoints) stopNames.add(waypoint.name);
  }

  const metaByName: Record<string, StopMeta> = {};
  for (const pandal of pandals) {
    if (!stopNames.has(pandal.name)) continue;
    metaByName[pandal.name] = {
      categories: pandal.categories || [],
      metro: pandal.metro || "",
      zone: pandal.zone || "",
    };
  }

  return <RoutesBoard routes={routes} copy={copy} metaByName={metaByName} />;
}
