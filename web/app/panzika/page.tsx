const FIXED_DAYS = [
  { name: "Maha Shashthi", date: "16 Oct", bn: "মহাষষ্ঠী", desc: "বোধন ও অধিবাস — The start of Durga Puja. Maa Durga is welcomed and awakened with evening Bodhon.", bhog: "Luchi, Chholar Dal, Sandesh & Malpua", key: "Bel tolai Bodhon & Dhak beats", rites: [["Kalparambha", "Morning · 06:15 AM"], ["Bodhon & Amantran", "Evening · 05:45 PM"], ["Adhibas", "Evening · 07:15 PM"]] },
  { name: "Maha Saptami", date: "17–18 Oct", bn: "সপ্তমী", desc: "Navapatrika Snan — bathing of the Nabapatrika (Kola Bou) and Pran Pratistha.", bhog: "Khichuri, Labra, Begun Bhaja", key: "Navapatrika & Pran Pratistha", rites: [["Navapatrika Snan", "Morning · 06:00 AM"], ["Pran Pratistha", "Morning · 08:30 AM"], ["Sandhi Aarati", "Evening · 06:00 PM"]] },
  { name: "Maha Ashtami", date: "19 Oct", bn: "অষ্টমী", desc: "Kumari Puja & the midnight Sandhi Puja junction rites with 108 lotuses and 108 diyas.", bhog: "Khichuri with Mishti Doi", key: "Sandhi Puja 08:54 – 09:42 PM", rites: [["Kumari Puja", "Morning"], ["Pushpanjali", "Morning"], ["Sandhi Puja", "08:54 – 09:42 PM"], ["Dhunuchi Naach & Aarati", "Evening"]] },
  { name: "Maha Nabami", date: "20 Oct", bn: "নবমী", desc: "Anjali followed by grand Dhunuchi Naach — the evening of incense dance and aarati.", bhog: "Basanti Pulao, Kosha Mangsho", key: "Maha Anjali & Dhunuchi", rites: [["Pushpanjali", "Morning"], ["Maha Anjali", "Evening · 05:30 PM"], ["Dhunuchi Naach", "Late Evening"]] },
  { name: "Vijaya Dashami", date: "21 Oct", bn: "দশমী", desc: "Sindoor Khela — Bengali women smear each other with vermilion in a bittersweet farewell.", bhog: "Mishti Doi, Payesh, Sandesh", key: "Sindoor Khela & Biday", rites: [["Sindoor Khela", "Morning · 09:00 AM"], ["Dhunuchi & Biday", "Afternoon"], ["Immersion Processions", "Evening onwards"]] },
];

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
          {FIXED_DAYS.map((d) => (
            <section key={d.name} className="rounded-3xl border border-[#EAD5A0] bg-white p-6">
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
              <p className="mt-3 text-xs text-[#2C1210]/70"><b>Bhog:</b> {d.bhog} · <b>Key:</b> {d.key}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
