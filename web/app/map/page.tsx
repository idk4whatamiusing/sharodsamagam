import fs from "fs";
import path from "path";
import MapView from "../../components/MapView";

export default function MapPage() {
  const pandals = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "pandals.json"), "utf8")
  );
  const points = pandals
    .filter((p: { lat: number | null; lng: number | null }) => p.lat != null && p.lng != null)
    .map((p: { lat: number; lng: number; name: string; slug: string }) => ({
      lat: p.lat,
      lng: p.lng,
      name: p.name,
      slug: p.slug,
    }));

  return (
    <main className="flex-grow">
      <div className="w-full max-w-6xl mx-auto px-4 pt-28 pb-16">
        <h1 className="font-serif text-4xl font-black text-[#2C1210]">Live Pandal Map</h1>
        <p className="text-sm text-[#2C1210]/60 mt-1">{points.length} mapped pandals across Kolkata</p>
        <div className="mt-6">
          <MapView points={points} height={600} />
        </div>
      </div>
    </main>
  );
}
