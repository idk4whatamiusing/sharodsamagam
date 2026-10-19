/**
 * Build-time rewrites for the Eden Gardens broadcast page.
 *
 * /eden-gardens-live ships two client controls with no server-rendered
 * behaviour of their own - the same class of gap as the hero dots and the
 * guide's transit map:
 *
 *  - "Theater Mode" switches the page container from max-w-5xl to max-w-7xl
 *    and relabels itself "Standard View" (the original's own strings).
 *  - "Share" hands {title, text, url} to navigator.share; when that is not
 *    available it copies the URL and swaps in a "Link Copied" state for
 *    2.5 seconds, exactly as the original's own component does.
 *
 * "Back to Map" is a plain link to / and needs nothing. The container and the
 * two buttons are tagged here; components/EdenLive.tsx wires them up.
 */

export function injectEdenLive(html: string): string {
  let out = html;

  // The page's single content column, the one the theater toggle widens.
  const wrap =
    '<div class="mx-auto px-4 sm:px-6 space-y-5 transition-all duration-300 max-w-5xl">';
  if (out.includes(wrap)) {
    out = out.replace(wrap, wrap.replace("<div ", "<div data-eden-wrap "));
  }

  // "Theater Mode" button: tag the button and its label span.
  const theaterTail = ">Theater Mode</span></button>";
  const ti = out.indexOf(theaterTail);
  if (ti !== -1) {
    const bstart = out.lastIndexOf("<button", ti);
    if (bstart !== -1) {
      out = out.slice(0, bstart + 7) + " data-eden-theater" + out.slice(bstart + 7);
    }
    out = out.replace("<span>Theater Mode</span>", "<span data-eden-label>Theater Mode</span>");
  }

  // "Share" button.
  const shareTail = ">Share</span></button>";
  const si = out.indexOf(shareTail);
  if (si !== -1) {
    const bstart = out.lastIndexOf("<button", si);
    if (bstart !== -1) {
      out = out.slice(0, bstart + 7) + " data-eden-share" + out.slice(bstart + 7);
    }
  }

  return out;
}
