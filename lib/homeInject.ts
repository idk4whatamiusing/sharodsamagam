/**
 * Build-time rewrites for mirror/home.html.
 *
 * The mirror files are scraped DOM snapshots: the interactive controls are
 * present but inert, because their React handlers never made it into the
 * markup. These helpers tag that inert markup with data attributes so a
 * small client component can wire it up, rather than re-rendering whole
 * sections and risking visual drift from the original design.
 */

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
    '<span data-mahalaya-status>Sharodotsav 2026</span>'
  );
}

const COUNTDOWN_SKELETON_OPEN =
  '<div class="flex items-center justify-between sm:justify-around py-1">';
const COUNTDOWN_SKELETON_CLOSE = '<p class="text-[8px] text-amber-200/50 font-mono pt-0.5">Sharodotsav 2026</p>';

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

  const end = html.indexOf(COUNTDOWN_SKELETON_CLOSE, start);
  if (end === -1) return html;

  return (
    html.slice(0, start) +
    '<div data-countdown-slot class="block"></div>' +
    html.slice(end + COUNTDOWN_SKELETON_CLOSE.length)
  );
}