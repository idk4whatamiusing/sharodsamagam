"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Drives the mobile Teen Chala carousel on the home page.
 *
 * The section is three viewports tall with a sticky stage inside; on the
 * original the 300%-wide row of three cards slides left as the section
 * scrolls past, and the card that is centred is the lit one while its
 * neighbours sit at 30% opacity. The scrape kept the row's opening
 * `translateX(0vw)` and the veils' `1 / .3 / .3` but nothing to move them,
 * so on a phone the section stuck on its first card for three screens.
 *
 * The mapping was read off the original in a phone-sized browser (0.1, 0.25,
 * 0.5, 0.75 and 1 of the section's scroll span):
 *
 *   progress = (scrollY - sectionTop) / (sectionHeight - viewportHeight),
 *              clamped to 0..1
 *   row      = translateX(-200vw * progress)      (so -200vw at the end)
 *   lit card = round(progress * (cards - 1))      (the second card takes over
 *              a quarter of the way in, the third at three quarters)
 *
 * Values are applied the way the original applies them: vw units on the
 * transform, inline opacity on the veils, both against the CSS transitions
 * already in the markup.
 */
export default function TeenChalaScroll() {
  // Re-scan on navigation; the layout outlives the page children.
  const pathname = usePathname();

  useEffect(() => {
    const section = document.querySelector<HTMLElement>('section[aria-label*="Teen Chala"]');
    if (!section) return;

    // The phone-only wrapper; the desktop block is a separate animation and
    // is left to its own video.
    const block = Array.from(section.children).find(
      (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("lg:hidden")
    );
    const row = block?.querySelector<HTMLElement>('div[style*="width:300%"]');
    if (!block || !row) return;

    const cards = Array.from(row.children).filter(
      (c): c is HTMLElement =>
        c instanceof HTMLElement && /width:\s*100vw/.test(c.getAttribute("style") || "")
    );
    if (cards.length < 2) return;

    const veils = cards.map((card) =>
      Array.from(card.querySelectorAll<HTMLElement>("div")).find(
        (d) =>
          /(^|;)\s*opacity\s*:/.test(d.getAttribute("style") || "") &&
          /transition\s*:\s*opacity/.test(d.getAttribute("style") || "")
      )
    );
    if (veils.some((v) => !v)) return;

    // The dimmed veils carry `opacity:0.3`, which also matches the selector
    // components/RevealScroll.tsx scans for, and a stray reveal would both
    // fight this loop and re-time the fade with a longer transition. Mark
    // them so that scan skips them.
    veils.forEach((v) => v!.setAttribute("data-teen-veil", ""));

    let raf = 0;
    const update = () => {
      raf = 0;
      const top = section.getBoundingClientRect().top + window.scrollY;
      const span = block.offsetHeight - window.innerHeight;
      const progress =
        span > 0 ? Math.min(1, Math.max(0, (window.scrollY - top) / span)) : 0;
      row.style.transform = `translateX(${(-200 * progress).toFixed(4)}vw)`;
      const active = Math.max(
        0,
        Math.min(cards.length - 1, Math.round(progress * (cards.length - 1)))
      );
      veils.forEach((veil, i) => {
        veil!.style.opacity = i === active ? "1" : "0.3";
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pathname]);

  return null;
}
