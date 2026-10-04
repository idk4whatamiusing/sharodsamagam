import fs from "fs";
import path from "path";
import Link from "next/link";

export default function ChroniclesPage() {
  const posts = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "chronicles.json"), "utf8")
  );
  const [lead, ...rest] = posts;
  return (
    <main className="flex-grow">
      <div className="w-full max-w-5xl mx-auto px-4 pt-28 pb-16">
        <h1 className="font-serif text-4xl font-black">Puja Chronicles</h1>
        <p className="text-sm text-[#2C1210]/60 mt-1">Stories of heritage, craft and culture.</p>

        <Link href={`/chronicles/${lead.slug}`} className="block mt-8 group">
          <img src={lead.img} alt={lead.title} className="w-full aspect-[16/7] object-cover rounded-3xl" />
          <h2 className="mt-4 font-serif text-3xl font-black group-hover:text-[#D90429] transition">{lead.title}</h2>
          <p className="mt-1 text-sm text-[#2C1210]/70 line-clamp-2">{lead.paras[0]}</p>
        </Link>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rest.map((c: { slug: string; title: string; img: string; paras: string[] }) => (
            <Link key={c.slug} href={`/chronicles/${c.slug}`} className="group rounded-2xl overflow-hidden border border-[#EAD5A0] bg-white">
              <img src={c.img} alt={c.title} className="w-full aspect-video object-cover" />
              <div className="p-4">
                <h3 className="font-serif font-bold group-hover:text-[#D90429] transition">{c.title}</h3>
                <p className="mt-1 text-xs text-[#2C1210]/60 line-clamp-2">{c.paras[0]}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
