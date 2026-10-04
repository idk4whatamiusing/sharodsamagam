import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Durga Puja Kolkata 2026",
    short_name: "Durga Puja Kolkata",
    description: "Sharodotsav 2026 — pandal directory, live map, panjika and city guide.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFDF5",
    theme_color: "#D90429",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
