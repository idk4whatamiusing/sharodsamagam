import fs from "fs";
import path from "path";
import { injectCountdownSlot, injectFestivalDayHooks } from "../lib/homeInject";

export default function Home() {
  const raw = fs.readFileSync(path.join(process.cwd(), "mirror", "home.html"), "utf8");

  // The mirror is an inert DOM snapshot. Tag the controls that lost their
  // React handlers so the client components can revive them.
  const html = injectFestivalDayHooks(injectCountdownSlot(raw));

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}