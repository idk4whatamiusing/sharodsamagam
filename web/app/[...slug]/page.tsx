import fs from "fs";
import path from "path";

const MIRROR = path.join(process.cwd(), "mirror");

function listFragments(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) out.push(path.relative(MIRROR, p).replace(/\.html$/, ""));
    }
  };
  walk(MIRROR);
  return out;
}

export function generateStaticParams() {
  return listFragments()
    .filter((r) => r !== "index")
    .map((r) => ({ slug: r.split("/") }));
}

export default async function MirrorPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const rel = slug.join("/");
  const file = path.join(MIRROR, rel + ".html");
  if (!fs.existsSync(file)) {
    // try nested index (e.g. /paras -> paras.html already covered)
    const idx = path.join(MIRROR, rel, "index.html");
    if (fs.existsSync(idx)) {
      const html = fs.readFileSync(idx, "utf8");
      return <div dangerouslySetInnerHTML={{ __html: html }} />;
    }
    return <div>Not found: {rel}</div>;
  }
  const html = fs.readFileSync(file, "utf8");
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
