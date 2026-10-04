import { mirrorHtml, listRoutes } from "../../lib/mirror";

export function generateStaticParams() {
  return listRoutes()
    .filter((r) => r !== "index" && !r.startsWith("_"))
    .map((r) => ({ slug: r.split("/") }));
}

export default async function MirrorPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const rel = slug.join("/");
  const html = mirrorHtml(rel);
  if (!html) return <div>Not found: {rel}</div>;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
