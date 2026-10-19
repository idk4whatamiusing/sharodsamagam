/**
 * Build-time rewrites for mirror/home.html.
 *
 * The mirror files are scraped DOM snapshots: the interactive controls are
 * present but inert, because their React handlers never made it into the
 * markup. These helpers tag that inert markup with data attributes so a
 * small client component can wire it up, rather than re-rendering whole
 * sections and risking visual drift from the original design.
 */

import fs from "fs";
import path from "path";

const DAY_TAB_OPEN =
  '<button type="button" class="group relative w-full flex-1';

/** Maps the tab's printed date ("Oct 18") to its data key. */
function keyForTabDate(tabDate: string): string | null {
  const compact = tabDate.toLowerCase().replace(/[\s\u2013\u2014]/g, "");
  if (compact.startsWith("oct16")) return "shashthi";
  // The mirror ships one tab covering "Oct 17-18". The original counts
  // Saptami as two days carrying different rites, so that single tab is
  // split in two below.
  if (compact.startsWith("oct17")) return "saptami1";
  if (compact.startsWith("oct18")) return "saptami2";
  if (compact.startsWith("oct19")) return "ashtami";
  if (compact.startsWith("oct20")) return "nabami";
  if (compact.startsWith("oct21")) return "dashami";
  return null;
}

/**
 * Tags the six vertical day tabs with `data-fday` and the adjacent detail
 * panel with `data-fday-panel`. Returns the HTML with those attributes added.
 */
export function injectFestivalDayHooks(html: string): string {
  let out = html;

  // 1. Panel wrapper -> data-fday-panel
  out = out.replace(
    '<div class="flex-1 min-w-0 relative rounded-2xl bg-gradient-to-br from-[#FFFDF5]',
    '<div data-fday-panel class="flex-1 min-w-0 relative rounded-2xl bg-gradient-to-br from-[#FFFDF5]'
  );

  // 2. Each tab button -> data-fday="<key>"
  //    Walk every occurrence of the tab open tag; for each one find the
  //    "Oct ..." span that follows it and derive the key from that.
  const OPEN_RE = /<button type="button" class="group relative w-full flex-1[^"]*"/g;
  let result = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = OPEN_RE.exec(out))) {
    result += out.slice(cursor, match.index);
    const tag = match[0];

    // Take the whole button, not just its open tag: splitting Saptami in
    // two requires a full second button, not a second <button ...>.
    const closeIdx = out.indexOf("</button>", match.index + tag.length);
    if (closeIdx < 0) {
      result += tag;
      cursor = match.index + tag.length;
      continue;
    }
    const full = out.slice(match.index, closeIdx + "</button>".length);
    const after = out.slice(match.index + tag.length, match.index + tag.length + 500);
    const dateMatch = after.match(/>([^<]*Oct[^<]*)</i);
    const printedDate = dateMatch ? dateMatch[1] : "";
    const key = printedDate ? keyForTabDate(printedDate) : null;

    if (printedDate.includes("17") && printedDate.includes("18")) {
      // "Oct 17-18" is one tab in the mirror but two days on the original.
      // Emit Oct 17 then Oct 18; FestivalDays fills the rest on hydration.
      result +=
        retag(full, "saptami1").replace(/>[^<]*Oct[^<]*</, ">Oct 17<") +
        retag(full, "saptami2").replace(/>[^<]*Oct[^<]*</, ">Oct 18<");
    } else {
      result += key ? retag(full, key) : full;
    }
    cursor = closeIdx + "</button>".length;
  }
  result += out.slice(cursor);

  return result;
}

/** Adds `data-fday="<key>"` to a complete tab button. */
function retag(button: string, key: string): string {
  return button.replace('class="', `data-fday="${key}" class="`);
}

// The scraped hero carries a hardcoded "8 Days to Mahalaya" pill. Mahalaya
// was 10 Oct 2026, so that string is permanently wrong. Swap the text node
// for a tagged slot and let FestivalStatus fill it in at runtime - a static
// export cannot compute it at build time without going stale immediately.
const MAHALAYA_TEXT = '8<!-- --> Days to Mahalaya';

export function injectFestivalStatusSlot(html: string): string {
  if (!html.includes(MAHALAYA_TEXT)) return html;
  return html.replace(
    MAHALAYA_TEXT,
    '<span data-mahalaya-status>Sharodsamagam 2026</span>'
  );
}

const COUNTDOWN_SKELETON_OPEN =
  '<div class="flex items-center justify-between sm:justify-around py-1">';
// The skeleton's last node is a small caption <p>. It is matched by its own
// classes rather than by its text, so the brand on the page can change without
// breaking where the slot ends.
const COUNTDOWN_SKELETON_CAPTION =
  '<p class="text-[8px] text-amber-200/50 font-mono pt-0.5">';

/**
 * Replaces the never-resolving Countdown Card skeleton with an empty slot
 * the Countdown component fills in.
 *
 * The skeleton is the stripped Suspense fallback from the original app:
 * a `BAILOUT_TO_CLIENT_SIDE_RENDERING` template held the real countdown and
 * was removed during RSC sanitisation, leaving the loading state behind.
 */
export function injectCountdownSlot(html: string): string {
  const start = html.indexOf(COUNTDOWN_SKELETON_OPEN);
  if (start === -1) return html;

  // Only touch the occurrence that sits inside the "Countdown Card".
  const cardIdx = html.indexOf("Countdown Card");
  if (cardIdx === -1 || cardIdx > start) return html;

  const end = html.indexOf(COUNTDOWN_SKELETON_CAPTION, start);
  if (end === -1) return html;
  const close = html.indexOf("</p>", end);
  if (close === -1) return html;
  const cut = close + "</p>".length;

  return (
    html.slice(0, start) +
    '<div data-countdown-slot class="block"></div>' +
    html.slice(cut)
  );
}

// --- hero carousel card -------------------------------------------------

const CARD_LABEL = "01 · PANDAL DIRECTORY";

/** Zone display colours, matching the badges ParasInteractions paints. */
const ZONE_COLOR: Record<string, string> = {
  south: "#D90429",
  north: "#4F46E5",
  east: "#059669",
  howrah: "#0891B2",
  central: "#D97706",
  others: "#475569",
};

const ZONE_LABEL: Record<string, string> = {
  south: "South",
  north: "North",
  east: "East",
  howrah: "Howrah",
  central: "Central",
  others: "Others",
};

function zoneCounts(): { zone: string; label: string; color: string; n: number }[] {
  const file = path.join(process.cwd(), "data", "pandals.json");
  const pandals = JSON.parse(fs.readFileSync(file, "utf8")) as { zone?: string }[];
  const counts = new Map<string, number>();
  for (const p of pandals) {
    const z = p.zone || "others";
    counts.set(z, (counts.get(z) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([zone, n]) => ({
      zone,
      n,
      label: ZONE_LABEL[zone] ?? zone,
      color: ZONE_COLOR[zone] ?? "#475569",
    }))
    .sort((a, b) => b.n - a.n || a.zone.localeCompare(b.zone));
}

/** Removes a `<div>` block whose opening tag is `openTag` and which holds no nested divs. */
function dropDivBlock(html: string, openTag: string, from: number): string {
  const start = html.indexOf(openTag, from);
  if (start === -1) return html;
  const end = html.indexOf("</div>", start);
  if (end === -1) return html;
  return html.slice(0, start) + html.slice(end + "</div>".length);
}

/**
 * Rebuilds the hero's "01 · PANDAL DIRECTORY" card.
 *
 * Three defects, all from the scrape rather than from the original's design:
 *
 *  1. The card body was a loading skeleton - four empty icon/label
 *     placeholders. That is the original app's Suspense fallback: the real
 *     content sat in a client-side bailout template that RSC sanitisation
 *     removed, so the fallback shipped instead. No capture of the site has
 *     ever contained the real slides. Replaced with the real zone breakdown,
 *     counted from data/pandals.json, which needs no invented content.
 *
 *  2. It advertised a seven-slide carousel with prev/next arrows. Both arrows
 *     and the card's own dot row pointed at slides the scrape never captured,
 *     so they are removed rather than left as controls that do nothing. The
 *     two dot rows further down the hero are trimmed to the captured slides
 *     by injectHeroDots.
 *
 *  3. The caption carried the original's own brand, "Sharodotsav", and the
 *     stats were stale. Corrected against the real dataset.
 */
export function injectHeroCard(html: string): string {
  const cardAt = html.indexOf(CARD_LABEL);
  if (cardAt === -1) return html;

  let out = html;

  // 1. Dead carousel chrome: the arrow pair and the seven slide dots.
  out = dropDivBlock(out, '<div class="flex items-center gap-1">', cardAt);
  out = dropDivBlock(
    out,
    '<div class="hidden sm:flex items-center justify-center gap-1.5 pt-1.5 pb-0.5">',
    cardAt
  );

  // 2. The skeleton body -> real zone counts.
  const zones = zoneCounts();
  const skeletonOpen =
    '<div class="flex items-center justify-between sm:justify-around py-1">';
  const skeletonStart = out.indexOf(skeletonOpen, cardAt);
  const skeletonEnd = out.indexOf(
    '<div class="pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-1.5">',
    skeletonStart
  );
  if (skeletonStart !== -1 && skeletonEnd > skeletonStart) {
    const tiles = zones
      .map(
        (z) =>
          `<a href="/paras" class="group/z flex flex-col items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:border-[#FFB800]/60 hover:bg-white/10 py-1.5 px-1 transition-all duration-200">` +
          `<span class="font-serif font-black text-[#FFB800] text-sm sm:text-base leading-none" style="color:${z.color}">${z.n}</span>` +
          `<span class="text-[8px] font-mono font-bold uppercase tracking-wider text-amber-100/70 mt-0.5 truncate max-w-full">${z.label}</span>` +
          `</a>`
      )
      .join("");
    out =
      out.slice(0, skeletonStart) +
      `<div class="grid grid-cols-3 gap-1.5 py-1" data-zone-breakdown>${tiles}</div>` +
      out.slice(skeletonEnd);
  }

  // 3. Brand, as a safety net: the mirror carries our own name, but a future
  //    re-harvest of the original would bring its name back in.
  out = out.split("Sharodotsav").join("Sharodsamagam");

  // 4. Stale stats. The card said "700+" and "5 Zones"; the dataset has
  //    776 pandals across 6 zones.
  const statOpen =
    '<div class="hidden sm:grid grid-cols-2 gap-2.5 pt-1">';
  const statStart = out.indexOf(statOpen, cardAt);
  if (statStart !== -1) {
    const block = out.slice(statStart, statStart + 1600);
    const pandalCount = zones.reduce((a, z) => a + z.n, 0);
    const patched = block
      .replace(">700+</p>", `>${pandalCount}</p>`)
      .replace(">5</p>", `>${zones.length}</p>`);
    out = out.slice(0, statStart) + patched + out.slice(statStart + 1600);
  }

  return out;
}

// --- hero slide dots ----------------------------------------------------

/**
 * Trims the hero's two surviving dot rows to the slides that exist, and tags
 * them for components/HeroSlides.tsx.
 *
 * The original hero is a seven-slide carousel, one slide per section of the
 * site. The scrape captured two of those slides - the panoramas in
 * public/hero_slides - and the other five panels hold no image at all. Both
 * dot rows still listed all seven, so five dots per row pointed at nothing.
 * The rows keep their first `HERO_SLIDES` dots, which name slides 01 and 02
 * and match the two panels that can be shown.
 */
const HERO_SLIDES = 2;

// The two rows are told apart by their opening tag. The slide row's tag - a
// bare "flex items-center gap-2 shrink-0" - is shared with the ticker chips,
// so it is only accepted when the original's own first dot follows it.
const HERO_JUMP_ROW_OPEN =
  '<div class="flex items-center justify-center gap-1.5 pt-4">';
const HERO_SLIDE_ROW_OPEN = '<div class="flex items-center gap-2 shrink-0">';
const HERO_SLIDE_ROW_HINT = '<button aria-label="Go to slide 1"';
const HERO_PANEL_OPEN = '<div class="absolute inset-0 transition-opacity';

/** Index of a row's opening tag, skipping lookalikes that lack `hint`. */
function rowAt(html: string, openTag: string, hint?: string): number {
  let at = html.indexOf(openTag);
  while (at !== -1 && hint && !html.startsWith(hint, at + openTag.length)) {
    at = html.indexOf(openTag, at + 1);
  }
  return at;
}

/** Keeps a dot row's first `keep` buttons, drops the rest, tags the row. */
function trimDotRow(
  html: string,
  openTag: string,
  keep: number,
  hint?: string
): string {
  const start = rowAt(html, openTag, hint);
  if (start === -1) return html;

  const inner = start + openTag.length;
  // Dot rows hold nothing but buttons, so the row ends at its first </div>.
  const end = html.indexOf("</div>", inner);
  if (end === -1) return html;

  const row = html.slice(inner, end);
  const buttons = [...row.matchAll(/<button[\s\S]*?<\/button>/g)];
  if (buttons.length <= keep) return html;

  const kept = buttons
    .slice(0, keep)
    .map((b) => b[0])
    .join("");
  const tagged = `${openTag.slice(0, 5)}data-hero-dots ${openTag.slice(5)}`;
  return html.slice(0, start) + tagged + kept + html.slice(end);
}

/** Tags each real slide panel with its index, in both hero variants. */
function tagHeroPanels(html: string): string {
  const images = [...html.matchAll(/src="\/hero_slides\/slide(\d)\.jpg"/g)];
  let out = html;

  // Right to left, so the indexes taken from the original string stay valid
  // for the occurrences that have not been rewritten yet.
  for (const image of images.reverse()) {
    const at = out.lastIndexOf(HERO_PANEL_OPEN, image.index!);
    if (at === -1) continue;
    const tag = `${HERO_PANEL_OPEN.slice(0, 5)}data-hero-slide="${
      Number(image[1]) - 1
    }" ${HERO_PANEL_OPEN.slice(5)}`;
    out = out.slice(0, at) + tag + out.slice(at + HERO_PANEL_OPEN.length);
  }

  return out;
}

/** Trims both hero dot rows and tags the rows and their slide panels. */
export function injectHeroDots(html: string): string {
  let out = trimDotRow(html, HERO_JUMP_ROW_OPEN, HERO_SLIDES);
  out = trimDotRow(out, HERO_SLIDE_ROW_OPEN, HERO_SLIDES, HERO_SLIDE_ROW_HINT);
  return tagHeroPanels(out);
}