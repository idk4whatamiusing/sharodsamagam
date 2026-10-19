import type { Metadata } from "next";
import { metadataForRoute } from "../../lib/meta";
import PanzikaCalendar from "../../components/PanzikaCalendar";

export const metadata: Metadata = metadataForRoute("panzika");

export default function PanzikaPage() {
  return (
    <main className="flex-grow">
      <div className="w-full max-w-5xl mx-auto px-4 pt-28 pb-16">
        <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#D90429]">
          Bisuddhasiddhanta &amp; Surya Siddhanta Tradition
        </p>
        <h1 className="mt-2 font-serif text-4xl font-black">
          Official Durga Puja 2026 Panzika
        </h1>
        <p className="mt-1 text-sm text-[#2C1210]/60">
          Authentic astronomical tithi timings, auspicious Muhurtas, Pushpanjali
          schedules &amp; Sandhi Puja calculations for Kolkata.
        </p>

        <div className="mt-8 rounded-3xl bg-[#2C1210] text-white p-8">
          <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#FFB800]">
            Most Sacred Astronomical Moment
          </p>
          <h2 className="mt-2 font-serif text-2xl font-black">
            Maha Ashtami Sandhi Puja 2026
          </h2>
          <p className="mt-2 text-sm text-white/80">
            The 48-minute celestial window spanning the last 24 minutes of Shukla
            Ashtami and the first 24 minutes of Shukla Nabami. Goddess Chamunda is
            worshipped with 108 red lotus flowers and 108 lighted earthen diyas.
          </p>
          <p className="mt-4 font-serif text-3xl font-black text-[#FFB800]">
            08:54 PM – 09:42 PM
          </p>
          <p className="text-xs text-white/70">
            Monday, 19th October 2026 · Kolkata
          </p>
        </div>

        <PanzikaCalendar />
      </div>
    </main>
  );
}