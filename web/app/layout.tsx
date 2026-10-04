import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Durga Puja Kolkata 2026",
  description: "Sharodotsav 2026 — the premier digital companion to Kolkata's grandest festival.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="merriweather_56ab4c38-module__2_Pdpa__variable figtree_b7e2f034-module__w_Yhsq__variable yatra_one_633d4550-module__1954vW__variable noto_serif_bengali_200af96a-module__4siQzG__variable fragment_mono_4699eca3-module__SiQ6WW__variable"
    >
      <head>
        <link rel="stylesheet" href="/static/css/0-x9199av3pjd.css" data-precedence="next" />
        <link rel="stylesheet" href="/static/css/0k7ka7ov05b06.css" data-precedence="next" />
        <link rel="stylesheet" href="/static/css/19rhlcx2srev9.css" data-precedence="next" />
      </head>
      <body className="bg-[#FFFDF5] text-[#2C1210] antialiased min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
