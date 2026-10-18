import type { MetadataRoute } from "next";

// Required for `output: "export"` — the manifest is a build-time file.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sharodsamagam 2026",
    short_name: "Sharodsamagam",
    description: "Sharodsamagam 2026 — pandal directory, live map, panjika and city guide.",
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
