import fs from "fs";
import path from "path";
import Link from "next/link";
import MapView from "../../../components/MapView";

const ZONE_COLORS: Record<string, string> = {
  north: "#4F46E5",
  south: "#D90429",
  east: "#059669",
  central: "#D97706",
  howrah: "#475569",
  others: "#475569",
};

export function generateStaticParams() {
  const pandals = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "pandals.json"), "utf8")
  );
  return pandals.map((p: { slug: string }) => ({ slug: p.slug }));
}

export default async function PandalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pandals = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "pandals.json"), "utf8")
  );
  const p = pandals.find((x: { slug: string }) => x.slug === slug);
  if (!p) return <main className="flex-grow pt-28 px-4">Not found</main>;
  const zc = ZONE_COLORS[p.zone || "others"] || ZONE_COLORS.others;
  const year = p.established ? 2026 - p.established : null;

  return (
    <main className="flex-grow">
      <div className="w-full max-w-4xl mx-auto px-4 pt-28 pb-16">
        <p className="text-xs text-[#2C1210]/60">
          <Link href="/paras" className="underline">All Pandals</Link> / {p.zone} Kolkata
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span
            className="text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest font-mono"
            style={{ backgroundColor: zc }}
          >
            {p.zone} Kolkata
          </span>
          {p.established && (
            <span className="bg-[#FFB800]/90 text-[#2C1210] text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full font-mono">
              Est. {p.established}
            </span>
          )}
        </div>

        <h1 className="mt-4 font-serif text-4xl font-black text-[#2C1210]">{p.name}</h1>
        <p className="mt-1 text-sm text-[#2C1210]/70">{p.address}</p>
        {p.nearestMetro && (
          <p className="mt-1 text-sm font-bold" style={{ color: zc }}>
            Nearest Metro: {p.nearestMetro}
          </p>
        )}

        <section className="mt-8">
          <h2 className="font-serif text-xl font-bold">Theme &amp; Concept</h2>
          <p className="mt-2 text-sm text-[#2C1210]/80 leading-relaxed">{p.description}</p>
        </section>

        <section className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            ["Heritage", year != null ? `${year}th Year` : "—"],
            ["Rating", p.rating != null ? `${p.rating} / 5.0` : "—"],
            ["Crowd Flow", p.crowdFlow || "—"],
            ["Visits", p.views ? `${p.views} views` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-[#EAD5A0] bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-widest font-mono text-[#2C1210]/50">{k}</p>
              <p className="mt-1 font-serif font-bold text-sm">{v}</p>
            </div>
          ))}
        </section>

        {p.lat != null && p.lng != null && (
          <div className="mt-8">
            <h2 className="font-serif text-xl font-bold mb-3">Location</h2>
            <MapView points={[{ lat: p.lat, lng: p.lng, name: p.name }]} height={320} />
            <p className="mt-2 text-xs text-[#2C1210]/60 font-mono">
              {p.lat.toFixed(5)}, {p.lng.toFixed(5)} · {p.address}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
