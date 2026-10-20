import type { Metadata } from "next";
import MapApp from "../../components/map/MapApp";

export const metadata: Metadata = {
  title: "Live Kolkata Durga Puja Pandal Map 2026 | Route Planner & Transit",
  description:
    "Interactive Kolkata Durga Puja map with 3,000+ pandal coordinates, live crowd indicators, Metro stations, police helpdesks, and custom walking & driving routes.",
  openGraph: {
    title: "Live Kolkata Durga Puja Pandal Map 2026 | Route Planner & Transit",
    description:
      "Interactive Kolkata Durga Puja map with 3,000+ pandals, live crowd status, Metro stations & walking routes.",
    type: "website",
    siteName: "Sharodsamagam",
    images: ["/og-image.png"],
  },
};

export default function KolkataMapPage() {
  return <MapApp />;
}
