import { mirrorHtml } from "../lib/mirror";

export default function Home() {
  const html = mirrorHtml("index");
  return <div dangerouslySetInnerHTML={{ __html: html || "" }} />;
}
