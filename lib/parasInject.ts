/**
 * Build-time rewrites for mirror/paras.html.
 *
 * The directory listing shipped 24 cards followed by a spinner reading
 * "Loading more pandals... (698 remaining)" that never resolved. That is
 * the original's infinite-scroll sentinel: the list reveals itself on scroll,
 * and a static scrape captures only the first page. Nothing on the page had
 * a data source for the other 752, so search and the zone chips could only
 * ever see those 24.
 *
 * The fix is progressive loading from public/paras.json rather than
 * server-rendering all 776. Each card is 4.2 KB of markup, so 776 of them
 * would be ~3.2 MB of HTML on one page. Batches keep the initial document
 * small and match how the original behaves.
 */

/** The scraped sentinel, spinner and all. Matched exactly and only once. */
const SENTINEL_OPEN =
  '<div class="py-8 flex flex-col items-center justify-center text-center space-y-2">';

const SENTINEL_TEXT = 'Loading more pandals... (<!-- -->698<!-- --> remaining)';

/**
 * Replaces the dead spinner with a slot the client fills, plus a running
 * count so the directory's real size is visible instead of implied.
 */
export function injectParasListing(html: string, total: number, shown: number): string {
  const start = html.indexOf(SENTINEL_OPEN);
  if (start === -1) return html;

  // Find the sentinel's two closing divs: the inner pill, then the wrapper.
  // Search from *after* each match, otherwise indexOf lands on the same one.
  const textAt = html.indexOf(SENTINEL_TEXT, start);
  if (textAt === -1) return html;
  const pillEnd = html.indexOf("</div>", textAt);
  const wrapperEnd = html.indexOf("</div>", pillEnd + "</div>".length);
  if (pillEnd === -1 || wrapperEnd === -1) return html;

  // Keep the original spinner markup; ParasInteractions shows and hides it.
  // `lastIndexOf` returns an index, not a distance from `pillEnd`.
  const pillOpen = html.lastIndexOf("<div", pillEnd);
  const spinner = pillOpen === -1 ? "" : html.slice(pillOpen, pillEnd);

  const slot =
    `<div data-paras-more class="py-8 flex flex-col items-center justify-center text-center gap-3">` +
    `<p data-paras-count class="text-xs font-mono text-[#2C1210]/55">` +
    `Showing ${shown} of ${total} pandals</p>` +
    `<div data-paras-sentinel class="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#FFFDF5] border border-[#EAD5A0] shadow-sm">` +
    spinner +
    `<span data-paras-loading class="text-xs font-serif font-bold text-[#2C1210]">Loading more pandals...</span>` +
    `</div>` +
    `<button type="button" data-paras-load class="px-4 py-2 rounded-full bg-[#2C1210] text-white text-xs font-mono font-black uppercase tracking-widest hover:bg-[#D90429] transition-colors">Load more</button>` +
    `</div>`;

  return html.slice(0, start) + slot + html.slice(wrapperEnd + "</div>".length);
}