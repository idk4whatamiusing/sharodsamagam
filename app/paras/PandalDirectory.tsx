"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Pandal = {
  slug: string;
  name: string;
  description: string;
  zone: string | null;
  established: number | null;
  rating: number | null;
  address: string;
};

const ZONE_COLORS: Record<string, { bg: string; grad: string }> = {
  north: { bg: "#4F46E5", grad: "linear-gradient(to right, #4F46E5, #818CF8, #C7D2FE)" },
  south: { bg: "#D90429", grad: "linear-gradient(to right, #D90429, #FFB800, #D97706)" },
  east: { bg: "#059669", grad: "linear-gradient(to right, #059669, #34D399, #6EE7B7)" },
  central: { bg: "#D97706", grad: "linear-gradient(to right, #D97706, #FBBF24, #FDE68A)" },
  howrah: { bg: "#475569", grad: "linear-gradient(to right, #475569, #64748B, #94A3B8)" },
  others: { bg: "#475569", grad: "linear-gradient(to right, #475569, #64748B, #94A3B8)" },
};

const ZONES = ["all", "north", "south", "central", "east", "howrah", "others"];

export default function PandalDirectory({ pandals }: { pandals: Pandal[] }) {
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pandals.filter((p) => {
      if (zone !== "all" && p.zone !== zone) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        p.address.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle)
      );
    });
  }, [pandals, q, zone]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-28 pb-16">
      <h1 className="font-serif text-4xl font-black text-[#2C1210]">Discover Kolkata Pandals</h1>
      <p className="text-sm text-[#2C1210]/60 mt-1">Search pandal, locality, artisan…</p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search pandals…"
        className="mt-5 w-full rounded-2xl border border-[#EAD5A0] bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D90429]"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {ZONES.map((z) => (
          <button
            key={z}
            onClick={() => setZone(z)}
            className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest font-mono border transition ${
              zone === z
                ? "bg-[#2C1210] text-white border-[#2C1210]"
                : "bg-white text-[#2C1210]/70 border-[#EAD5A0] hover:border-[#D90429]"
            }`}
          >
            {z}
          </button>
        ))}
        <span className="ml-auto text-xs text-[#2C1210]/60 self-center">
          {filtered.length} pandals
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.slice(0, 60).map((p) => {
          const zc = ZONE_COLORS[p.zone || "others"] || ZONE_COLORS.others;
          return (
            <Link key={p.slug} href={`/paras/${p.slug}`} className="block h-full">
              <article
                className="h-full flex flex-col bg-white rounded-3xl overflow-hidden border-2 transition-all duration-500"
                style={{ borderColor: "#EAD5A0", boxShadow: "0 4px 24px -4px rgba(0,0,0,0.08)" }}
              >
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: "3/2" }}>
                  <img
                    alt={p.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                    src="/pandals/maddox_square.jpg"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.1) 100%)",
                    }}
                  />
                  <div
                    className="absolute top-3 left-3 text-white px-3 py-1 rounded-full"
                    style={{ backgroundColor: zc.bg }}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest font-mono">
                      {p.zone}
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
                    {p.established && (
                      <div className="inline-block bg-[#FFB800]/90 text-[#2C1210] text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full font-mono">
                        Est. {p.established}
                      </div>
                    )}
                    <h3 className="font-serif font-bold text-xl leading-tight text-white line-clamp-2">
                      {p.name}
                    </h3>
                    {p.rating != null && (
                      <span className="text-white/90 text-[11px] font-bold">★ {p.rating}</span>
                    )}
                  </div>
                </div>
                <div className="transition-all duration-300" style={{ height: 3, background: zc.grad }} />
                <div className="p-4 flex-grow flex flex-col gap-3">
                  <p className="text-[11px] text-[#2C1210]/70 font-medium truncate">{p.address}</p>
                  <p className="text-xs text-[#2C1210]/75 line-clamp-2 leading-relaxed">{p.description}</p>
                  <div className="mt-auto pt-3 border-t border-[#EAD5A0] flex items-center justify-end">
                    <div className="flex items-center gap-1 font-serif font-bold text-xs" style={{ color: "#D90429" }}>
                      <span>Explore</span>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </div>
      {filtered.length > 60 && (
        <p className="mt-6 text-center text-xs text-[#2C1210]/60">
          Showing 60 of {filtered.length} — refine search to narrow down
        </p>
      )}
    </div>
  );
}
