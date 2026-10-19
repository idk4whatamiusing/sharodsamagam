/**
 * Harvests the four accordion panels in the mobile footer.
 *
 * WHY
 * The footer's section headers ("Pandal Circuits & Zones", "Smart Travel & City
 * Guide", "Culture, Lore & Media", "About & Assistance") are React accordions
 * on the original. The scrape kept the collapsed headers and nothing else, so
 * on the mirror they toggle aria-expanded and reveal nothing - a row of dead
 * controls on every page. The panels cannot be read from the HTML alone
 * because they are rendered on click, so they are read here, in a real
 * browser at a phone viewport, and written to data/mobile-sheet.json for
 * lib/chromeInject.ts to graft into the chrome at build time.
 *
 * Two items the original lists are dropped, with the reason recorded in the
 * output:
 *   /admin/login  the administrator portal is not part of this mirror
 *   /bhog         not mirrored: the Bhog register renders from a live,
 *                 client-only store the scrape never captured
 *
 * Usage: node scripts/harvest-mobile-sheet.mjs
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const ORIGIN = "https://www.durgapujakolkata.in/";

const SECTIONS = [
  { key: "circuits", title: "Pandal Circuits & Zones" },
  { key: "guide", title: "Smart Travel & City Guide" },
  { key: "culture", title: "Culture, Lore & Media" },
  { key: "about", title: "About & Assistance" },
];

const DROP = {
  "/admin/login": "the administrator portal is not part of this mirror",
  "/bhog": "not mirrored: renders from a live client-only register",
};

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
page.setDefaultTimeout(90000);

console.log(`opening ${ORIGIN} at a phone viewport...`);
await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);

const panels = [];
const problems = [];

for (const section of SECTIONS) {
  const panel = await page.evaluate(
    async ({ title, drop }) => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        (b.textContent || "").replace(/\s+/g, " ").includes(title)
      );
      if (!button) return { error: "section header not found" };
      button.click();
      await new Promise((r) => setTimeout(r, 700));
      const panel = button.nextElementSibling;
      if (!panel || panel.tagName !== "DIV") return { error: "no panel appeared" };

      const dropped = [];
      for (const a of [...panel.querySelectorAll("a[href]")]) {
        const href = a.getAttribute("href") || "";
        if (drop[href]) {
          dropped.push({ href, item: (a.textContent || "").replace(/\s+/g, " ").trim(), reason: drop[href] });
          a.remove();
        }
      }
      return {
        html: panel.outerHTML,
        links: [...panel.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
        dropped,
      };
    },
    { title: section.title, drop: DROP }
  );

  if (panel.error) {
    problems.push(`${section.title}: ${panel.error}`);
    continue;
  }
  if (!panel.links.length || !panel.links.every((h) => h.startsWith("/"))) {
    problems.push(`${section.title}: unexpected links ${JSON.stringify(panel.links)}`);
    continue;
  }

  // The mirror hides the panel until its header is pressed; the toggle in
  // components/ClientNav.tsx looks at the button's own next sibling.
  const html = panel.html.replace(
    /^<div /,
    `<div data-sheet-panel="${section.key}" style="display:none" `
  );
  panels.push({ key: section.key, title: section.title, count: panel.links.length, html });
  console.log(
    `  ${section.title}: ${panel.links.length} items` +
      (panel.dropped.length ? ` (dropped ${panel.dropped.map((d) => d.href).join(", ")})` : "")
  );
  for (const d of panel.dropped) console.log(`      - ${d.href}: ${d.reason}`);
}

await browser.close();

if (problems.length) {
  console.error("\nFAILED:");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
if (panels.length !== SECTIONS.length) {
  console.error(`only ${panels.length} of ${SECTIONS.length} panels captured`);
  process.exit(1);
}

const out = {
  _provenance: {
    source: ORIGIN,
    harvested: new Date().toISOString(),
    note:
      "The mobile footer's four accordion panels, read by clicking each header " +
      "in a real browser (they render on click). The administrator portal link " +
      "is dropped, and /bhog with it because that page is not mirrored.",
  },
  panels,
};

writeFileSync("data/mobile-sheet.json", JSON.stringify(out, null, 2) + "\n");
console.log(
  `\nwrote data/mobile-sheet.json: ${panels.length} panels, ` +
    `${panels.reduce((n, p) => n + p.count, 0)} links`
);
