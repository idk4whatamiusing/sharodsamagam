import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import Script from "next/script";
import ClientNav from "../components/ClientNav";
import GalleryMotion from "../components/GalleryMotion";
import RevealScroll from "../components/RevealScroll";
import AudioPlayer from "../components/AudioPlayer";
import ParasInteractions from "../components/ParasInteractions";
import MapInjector from "../components/MapInjector";
import "./globals.css";

const MIRROR = path.join(process.cwd(), "mirror");
const CHROME_HEAD = fs.readFileSync(path.join(MIRROR, "_chrome_head.html"), "utf8");
const CHROME_FOOT = fs.readFileSync(path.join(MIRROR, "_chrome_foot.html"), "utf8");
const TRACKS = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "music.json"), "utf8"));
    return j.tracks.map((t: { title: string; artist: string; filename: string; durationLabel: string }) => ({
      title: t.title, artist: t.artist, filename: t.filename, durationLabel: t.durationLabel,
    }));
  } catch { return []; }
})();

export const metadata: Metadata = {
  title: "Sharodsamagam 2026",
  description: "Sharodotsav 2026 — the premier digital companion to Kolkata's grandest festival.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="merriweather_56ab4c38-module__2_Pdpa__variable figtree_b7e2f034-module__w_Yhsq__variable yatra_one_633d4550-module__1954vW__variable noto_serif_bengali_200af96a-module__4siQzG__variable fragment_mono_4699eca3-module__SiQ6WW__variable"
    >
      <head>
        {/* Hand-written <link> tags must NOT carry data-precedence: React's
            client head reconciler hoists precedence-tagged resources and then
            fails to match the server's ordering against <meta charset>,
            throwing a root-level hydration mismatch (React #418). Plain
            links render in place and hydrate cleanly. */}
        <link rel="stylesheet" href="/static/css/0-x9199av3pjd.css" />
        <link rel="stylesheet" href="/static/css/0k7ka7ov05b06.css" />
        <link rel="stylesheet" href="/static/css/19rhlcx2srev9.css" />
      </head>
      <body className="bg-[#FFFDF5] text-[#2C1210] antialiased min-h-screen flex flex-col">
        <div dangerouslySetInnerHTML={{ __html: CHROME_HEAD }} />
        <div className="flex-grow" style={{ minHeight: "100vh" }}>{children}</div>
        <div dangerouslySetInnerHTML={{ __html: CHROME_FOOT }} />
        <AudioPlayer tracks={TRACKS} />
        <ClientNav />
        <GalleryMotion />
        <RevealScroll />
        <ParasInteractions />
        <MapInjector />
        {/* A raw <script> child of a React component is never executed during
            client rendering, so the worker was never registered after a
            soft navigation. next/script handles the client mount properly. */}
        <Script id="sw-register" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}`}
        </Script>
      </body>
    </html>
  );
}
