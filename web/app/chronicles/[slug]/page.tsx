import fs from "fs";
import path from "path";
import Link from "next/link";

export function generateStaticParams() {
  const posts = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "chronicles.json"), "utf8")
  );
  return posts.map((p: { slug: string }) => ({ slug: p.slug }));
}

export default async function ChronicleArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const posts = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "chronicles.json"), "utf8")
  );
  const post = posts.find((p: { slug: string }) => p.slug === slug);
  if (!post) return <main className="flex-grow pt-28 px-4">Not found</main>;
  return (
    <main className="flex-grow">
      <article className="w-full max-w-3xl mx-auto px-4 pt-28 pb-16">
        <Link href="/chronicles" className="text-xs underline text-[#2C1210]/60">← All Chronicles</Link>
        <h1 className="mt-4 font-serif text-4xl font-black">{post.title}</h1>
        <img src={post.img} alt={post.title} className="mt-6 w-full aspect-video object-cover rounded-3xl" />
        <div className="mt-6 space-y-4">
          {post.paras.map((t: string, i: number) => (
            <p key={i} className="text-sm leading-relaxed text-[#2C1210]/80">{t}</p>
          ))}
        </div>
      </article>
    </main>
  );
}
