import { FESTIVAL_DAYS } from "../../lib/festivalDays";

export default function PanzikaPage() {
  return (
    <main className="flex-grow">
      <div className="w-full max-w-5xl mx-auto px-4 pt-28 pb-16">
        <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#D90429]">Bisuddhasiddhanta &amp; Surya Siddhanta Tradition</p>
        <h1 className="mt-2 font-serif text-4xl font-black">Official Durga Puja 2026 Panzika</h1>
        <p className="mt-1 text-sm text-[#2C1210]/60">Astronomical tithi timings, Muhurtas, Pushpanjali schedules &amp; Sandhi Puja calculations for Kolkata.</p>

        <div className="mt-8 rounded-3xl bg-[#2C1210] text-white p-8">
          <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#FFB800]">Most Sacred Astronomical Moment</p>
          <h2 className="mt-2 font-serif text-2xl font-black">Maha Ashtami Sandhi Puja 2026</h2>
          <p className="mt-2 text-sm text-white/80">
            The 48-minute celestial window spanning the last 24 minutes of Shukla Ashtami and the first 24 minutes of Shukla Nabami. Goddess Chamunda is worshipped with 108 lotus flowers and 108 diyas.
          </p>
          <p className="mt-4 font-serif text-3xl font-black text-[#FFB800]">08:54 PM – 09:42 PM</p>
          <p className="text-xs text-white/70">Monday, 19th October 2026 · Kolkata</p>
        </div>

        <h2 className="mt-12 font-serif text-2xl font-black">Devi Paksha Schedule</h2>
        <div className="mt-4 space-y-4">
          {FESTIVAL_DAYS.map((d) => (
            <section key={d.key} className="rounded-3xl border border-[#EAD5A0] bg-white p-6">
              <div className="flex items-baseline gap-3">
                <h3 className="font-serif text-xl font-black text-[#D90429]">{d.name}</h3>
                <span className="text-sm font-serif">{d.bn}</span>
                <span className="ml-auto text-xs font-mono font-black uppercase tracking-widest text-[#2C1210]/60">{d.date}</span>
              </div>
              <p className="mt-2 text-sm text-[#2C1210]/80">{d.desc}</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                {d.rites.map(([k, v]) => (
                  <p key={k} className="text-xs border-b border-[#EAD5A0]/60 py-1.5 flex justify-between">
                    <span className="font-bold">{k}</span>
                    <span className="text-[#2C1210]/60">{v}</span>
                  </p>
                ))}
              </div>
              <p className="mt-3 text-xs text-[#2C1210]/70"><b>Bhog:</b> {d.bhog} · <b>Key:</b> {d.highlight}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
