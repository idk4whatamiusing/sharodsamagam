import fs from "fs";
import path from "path";
import Link from "next/link";

const FESTIVAL_START = new Date("2026-10-16T06:00:00+05:30");

const DAYS = [
  { date: "Oct 16", name: "Shashthi", bn: "ষষ্ঠী" },
  { date: "Oct 17–18", name: "Saptami", bn: "সপ্তমী (২ দিন)" },
  { date: "Oct 19", name: "Ashtami", bn: "অষ্টমী" },
  { date: "Oct 20", name: "Nabami", bn: "নবমী" },
  { date: "Oct 21", name: "Dashami", bn: "দশমী" },
];

const CHRONICLES = [
  { slug: "history-of-kolkata-durga-puja", title: "The History of Kolkata Durga Puja", img: "/chronicles/history.jpg", cat: "History", read: "9 min read" },
  { slug: "kumartuli-where-goddesses-are-born", title: "Kumartuli: Where Goddesses Are Born", img: "/chronicles/kumartuli.jpg", cat: "Kumartuli", read: "8 min read" },
  { slug: "first-timers-guide-pandal-hopping", title: "A First-Timer's Guide to Pandal Hopping", img: "/chronicles/pandal_hopping.jpg", cat: "Guide", read: "7 min read" },
  { slug: "art-of-dhak-heartbeat-durga-puja", title: "The Art of Dhak: The Heartbeat of Durga Puja", img: "/chronicles/dhak.jpg", cat: "Music", read: "8 min read" },
  { slug: "sindoor-khela-bittersweet-farewell", title: "Sindoor Khela: The Bittersweet Farewell", img: "/chronicles/sindoor_khela.jpg", cat: "Tradition", read: "7 min read" },
];

const GUIDE = [
  { href: "/guide/navigating-kolkata", title: "Transport & Metro", desc: "All-night metro, auto routes & parking." },
  { href: "/guide/accommodation", title: "Where to Stay", desc: "Hotels & heritage stays near pandals." },
  { href: "/guide/food-trail", title: "Food Trails", desc: "Street rolls, sweets & festive bhog." },
  { href: "/guide/emergency", title: "Safety & Helplines", desc: "Police booths & emergency contacts." },
];

function daysUntil(target: Date) {
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 86400000));
}

export default function Home() {
  const pandals = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "pandals.json"), "utf8")
  );
  const featured = pandals
    .slice()
    .sort((a: { rating: number }, b: { rating: number }) => b.rating - a.rating)
    .slice(0, 8);
  const days = daysUntil(FESTIVAL_START);

  return (
    <main className="flex-grow">
      {/* Hero */}
      <section className="relative w-full overflow-hidden" style={{ minHeight: "70vh" }}>
        <img src="/hero_slides/slide1.jpg" alt="Kolkata Durga Puja" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end h-full min-h-[70vh] p-6 sm:p-12 max-w-6xl mx-auto">
          <p className="text-[#FFB800] font-mono text-xs font-black uppercase tracking-widest">Sharodotsav 2026 · Kolkata</p>
          <h1 className="mt-2 font-serif text-4xl sm:text-6xl font-black text-white leading-tight">
            Kolkata Durga Puja 2026 <br /> UNESCO Heritage — 700+ Pandals
          </h1>
          <p className="mt-2 text-white/80 font-mono uppercase tracking-widest text-sm">এবার পুজো জমজমাট · CHOLO PUJO DEKHI</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/paras" className="bg-[#D90429] text-white px-6 py-3 rounded-full font-serif font-bold text-sm">Browse 700+ Pandals</Link>
            <Link href="/map" className="bg-white/10 backdrop-blur text-white border border-white/30 px-6 py-3 rounded-full font-serif font-bold text-sm">Live Pandal Map</Link>
          </div>
        </div>
      </section>

      {/* Countdown + quick links */}
      <section className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-2 lg:col-span-1 rounded-3xl bg-[#2C1210] text-white p-6">
          <p className="text-[10px] font-black uppercase tracking-widest font-mono text-[#FFB800]">Countdown</p>
          <p className="mt-1 font-serif text-5xl font-black">{days}</p>
          <p className="text-xs text-white/70">days to Maha Shashthi · Oct 16, 2026</p>
        </div>
        {[
          { href: "/paras", big: "700+", small: "Pandals" },
          { href: "/map", big: "LIVE", small: "Pandal Map" },
          { href: "/panzika", big: "1433", small: "Digital Panjika" },
        ].map((q) => (
          <Link key={q.href} href={q.href} className="rounded-3xl border border-[#EAD5A0] bg-white p-6 hover:border-[#D90429] transition">
            <p className="font-serif text-3xl font-black text-[#D90429]">{q.big}</p>
            <p className="text-xs font-mono uppercase tracking-widest text-[#2C1210]/60">{q.small}</p>
          </Link>
        ))}
      </section>

      {/* Panzika strip */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <h2 className="font-serif text-2xl font-black">Durga Puja Days &amp; Timings</h2>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {DAYS.map((d) => (
            <Link key={d.name} href="/panzika" className="rounded-2xl border border-[#EAD5A0] bg-white p-4 text-center hover:border-[#D90429] transition">
              <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#D90429]">{d.date}</p>
              <p className="mt-1 font-serif font-bold">{d.name}</p>
              <p className="text-xs text-[#2C1210]/60">{d.bn}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured pandals */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-black">Featured Pandals</h2>
          <Link href="/paras" className="text-xs font-bold text-[#D90429]">View all 700+ →</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {featured.map((p: { slug: string; name: string; rating: number; zone: string; established: number | null }) => (
            <Link key={p.slug} href={`/paras/${p.slug}`} className="group rounded-2xl overflow-hidden border border-[#EAD5A0] bg-white">
              <div className="relative aspect-[3/2]">
                <img src="/pandals/maddox_square.jpg" alt={p.name} className="absolute inset-0 w-full h-full object-cover transition group-hover:scale-105" />
                <span className="absolute top-2 left-2 bg-[#FFB800]/90 text-[#2C1210] text-[9px] font-black font-mono uppercase px-2 py-0.5 rounded-full">
                  {p.zone}
                </span>
              </div>
              <div className="p-3">
                <p className="font-serif font-bold text-xs leading-tight line-clamp-2">{p.name}</p>
                <p className="mt-1 text-[10px] text-[#2C1210]/60">★ {p.rating}{p.established ? ` · Est. ${p.established}` : ""}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Chronicles */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <h2 className="font-serif text-2xl font-black">Puja Chronicles — Stories of Heritage</h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CHRONICLES.map((c) => (
            <Link key={c.slug} href={`/chronicles/${c.slug}`} className="group rounded-2xl overflow-hidden border border-[#EAD5A0] bg-white">
              <img src={c.img} alt={c.title} className="w-full aspect-video object-cover" />
              <div className="p-4">
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#D90429]">{c.cat} · {c.read}</p>
                <h3 className="mt-1 font-serif font-bold group-hover:text-[#D90429] transition">{c.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* City guide */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="font-serif text-2xl font-black">Pujo Parikrama &amp; City Guide</h2>
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {GUIDE.map((g) => (
            <Link key={g.href} href={g.href} className="rounded-2xl border border-[#EAD5A0] bg-white p-5 hover:border-[#D90429] transition">
              <h3 className="font-serif font-bold">{g.title}</h3>
              <p className="mt-1 text-xs text-[#2C1210]/60">{g.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
