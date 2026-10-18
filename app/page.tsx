import fs from "fs";
import path from "path";
import {
  injectCountdownSlot,
  injectFestivalDayHooks,
  injectFestivalStatusSlot,
  injectHeroCard,
} from "../lib/homeInject";

export default function Home() {
  const raw = fs.readFileSync(path.join(process.cwd(), "mirror", "home.html"), "utf8");

  // The mirror is an inert DOM snapshot. Tag the controls that lost their
  // React handlers so the client components can revive them, replace the
  // hardcoded "8 Days to Mahalaya" pill with a slot that can stay accurate,
  // and rebuild the hero card, whose body shipped as a loading skeleton.
  const html = injectHeroCard(
    injectFestivalDayHooks(injectCountdownSlot(injectFestivalStatusSlot(raw)))
  );

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}