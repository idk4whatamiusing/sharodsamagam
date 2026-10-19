/**
 * Build-time rewrites for the shared chrome (mirror/_chrome_foot.html).
 *
 * The mobile footer's four section headers ("Pandal Circuits & Zones", and so
 * on) shipped from the scrape collapsed, and the panels behind them are
 * rendered on click, so the mirror kept the headers with nothing to expand -
 * four dead controls on every page. The panels are re-harvested in a real
 * browser at a phone viewport (scripts/harvest-mobile-sheet.mjs writes
 * data/mobile-sheet.json) and grafted in here, hidden, as each header
 * button's own next sibling - the node components/ClientNav.tsx toggles.
 */

import fs from "fs";
import path from "path";

type SheetPanel = { key: string; title: string; count: number; html: string };

let cached: SheetPanel[] | null = null;

function panels(): SheetPanel[] {
  if (!cached) {
    const file = path.join(process.cwd(), "data", "mobile-sheet.json");
    cached = (JSON.parse(fs.readFileSync(file, "utf8")) as { panels: SheetPanel[] }).panels;
  }
  return cached;
}

export function injectMobilePanels(chromeFoot: string): string {
  let out = chromeFoot;
  for (const panel of panels()) {
    if (out.includes(`data-sheet-panel="${panel.key}"`)) continue;
    // Each header title appears exactly once in the chrome; the panel follows
    // the button that carries it.
    const title = panel.title.replace(/&/g, "&amp;");
    const at = out.indexOf(`${title}</span>`);
    if (at === -1) continue;
    const close = out.indexOf("</button>", at);
    if (close === -1) continue;
    const insert = close + "</button>".length;
    out = out.slice(0, insert) + panel.html + out.slice(insert);
  }
  return out;
}
