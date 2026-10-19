"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Wires the Eden Gardens broadcast page's two client controls.
 *
 * Both are React handlers on the original and were frozen shut in the static
 * scrape; lib/edenInject leaves [data-eden-wrap], [data-eden-theater] and
 * [data-eden-share] behind for this component to pick up, the same way the
 * metro map and the home day strip are revived.
 *
 * Behaviour is the original's own, read from its component chunk:
 *  - theater mode widens the container to max-w-7xl and relabels the button
 *    "Standard View";
 *  - share passes {title, text, url} to navigator.share, and when that is not
 *    available copies the URL to the clipboard and shows "Link Copied" for
 *    2.5 seconds, with Phosphor's bold CheckCircle glyph (the exact path the
 *    original bundles).
 */

const TITLE = "Eden Gardens Mahalaya 2026 Mega Celebration";
const TEXT = "Watch the historic Eden Gardens Mahalaya 2026 celebration live from Kolkata!";
const COPIED_MS = 2500;

const CHECK_CIRCLE_BOLD =
  "M172.24,99.76a6,6,0,0,1,0,8.48l-56,56a6,6,0,0,1-8.48,0l-24-24a6,6,0,0,1,8.48-8.48L112,151.51l51.76-51.75A6,6,0,0,1,172.24,99.76ZM230,128A102,102,0,1,1,128,26,102.12,102.12,0,0,1,230,128Zm-12,0a90,90,0,1,0-90,90A90.1,90.1,0,0,0,218,128Z";

const COPIED_HTML =
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">` +
  `<path d="${CHECK_CIRCLE_BOLD}"></path></svg><span>Link Copied</span>`;

export default function EdenLive() {
  // Re-scan on navigation; the layout outlives the page children.
  const pathname = usePathname();

  useEffect(() => {
    const wrap = document.querySelector<HTMLElement>("[data-eden-wrap]");
    const theater = document.querySelector<HTMLElement>("[data-eden-theater]");
    const share = document.querySelector<HTMLElement>("[data-eden-share]");
    if (!wrap && !theater && !share) return;

    const cleanups: Array<() => void> = [];
    let copiedTimer: number | undefined;

    if (wrap && theater) {
      const label = theater.querySelector<HTMLElement>("[data-eden-label]");
      const onClick = () => {
        const theaterOn = wrap.classList.toggle("max-w-7xl");
        wrap.classList.toggle("max-w-5xl", !theaterOn);
        if (label) label.textContent = theaterOn ? "Standard View" : "Theater Mode";
      };
      theater.addEventListener("click", onClick);
      cleanups.push(() => theater.removeEventListener("click", onClick));
    }

    if (share) {
      const resting = share.innerHTML;
      const onShare = async () => {
        const payload = { title: TITLE, text: TEXT, url: window.location.href };
        if (typeof navigator !== "undefined" && navigator.share) {
          try {
            await navigator.share(payload);
            return;
          } catch {
            // Cancelled or unsupported: fall through to copying, as the
            // original does.
          }
        }
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(payload.url);
            share.innerHTML = COPIED_HTML;
            window.clearTimeout(copiedTimer);
            copiedTimer = window.setTimeout(() => {
              share.innerHTML = resting;
            }, COPIED_MS);
          } catch {
            // Clipboard refused (permissions, insecure context): leave the
            // button as it is rather than claim a copy that did not happen.
          }
        }
      };
      share.addEventListener("click", onShare);
      cleanups.push(() => {
        share.removeEventListener("click", onShare);
        window.clearTimeout(copiedTimer);
        share.innerHTML = resting;
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, [pathname]);

  return null;
}
