import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { metadataForRoute } from "../lib/meta";
import {
  injectCountdownSlot,
  injectFestivalDayHooks,
  injectFestivalStatusSlot,
  injectHeroCard,
  injectHeroDots,
} from "../lib/homeInject";

// The home page is served by app/page.tsx rather than the catch-all, so it
// needs the index entry of the harvested metadata explicitly.
export const metadata: Metadata = metadataForRoute("index");

export default function Home() {
  const raw = fs.readFileSync(path.join(process.cwd(), "mirror", "home.html"), "utf8");

  // The mirror is an inert DOM snapshot. Tag the controls that lost their
  // React handlers so the client components can revive them, replace the
  // hardcoded "8 Days to Mahalaya" pill with a slot that can stay accurate,
  // and rebuild the hero card, whose body shipped as a loading skeleton.
  // Finally trim the hero's dot rows: they advertised seven slides, two of
  // which were ever captured.
  const html = injectHeroDots(
    injectHeroCard(
      injectFestivalDayHooks(injectCountdownSlot(injectFestivalStatusSlot(raw)))
    )
  );

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}