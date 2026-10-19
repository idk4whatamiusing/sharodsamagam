"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Revives the hero's dot rows.
 *
 * The rows arrive from mirror/home.html with their React handlers stripped,
 * and each listed seven slides when only two were ever captured. injectHeroDots
 * (lib/homeInject.ts) trims them and tags what is left: the rows as
 * [data-hero-dots], the two real backdrop panels as [data-hero-slide].
 *
 * Both hero variants - the phone layout and the desktop one - hold the same two
 * slides, so a click drives all of them and the variant that is off screen
 * simply follows along. Dot styling is not hard-coded: each row ships one lit
 * dot and one idle dot, and this re-applies their own class strings.
 */
export default function HeroSlides() {
  // Re-scan on navigation; the layout outlives the page children.
  const pathname = usePathname();

  useEffect(() => {
    const rows = [...document.querySelectorAll<HTMLElement>("[data-hero-dots]")];
    const panels = [...document.querySelectorAll<HTMLElement>("[data-hero-slide]")];
    if (rows.length === 0 || panels.length === 0) return;

    const controls = rows.map((row) => {
      const dots = [...row.querySelectorAll<HTMLButtonElement>("button")];
      const idle = dots.find((dot) => dot.classList.contains("bg-white/30"));
      const lit = dots.find((dot) => dot !== idle) ?? dots[0];
      return { dots, lit: lit?.className ?? "", idle: idle?.className ?? "" };
    });

    const show = (index: number) => {
      for (const panel of panels) {
        const on = Number(panel.dataset.heroSlide) === index;
        panel.classList.toggle("opacity-100", on);
        panel.classList.toggle("z-10", on);
        panel.classList.toggle("opacity-0", !on);
        panel.classList.toggle("z-0", !on);
        // The lit panel is the only one that should catch the pointer.
        panel.classList.toggle("pointer-events-none", !on);
      }
      for (const { dots, lit, idle } of controls) {
        dots.forEach((dot, i) => {
          dot.className = i === index ? lit : idle;
          dot.setAttribute("aria-current", String(i === index));
        });
      }
    };

    const onClick = (event: Event) => {
      const dot = (event.target as HTMLElement | null)?.closest("button");
      const row = dot?.parentElement;
      if (!dot || !row || !row.hasAttribute("data-hero-dots")) return;
      const index = [...row.children].indexOf(dot);
      if (index !== -1) show(index);
    };

    for (const row of rows) row.addEventListener("click", onClick);
    show(0);

    return () => {
      for (const row of rows) row.removeEventListener("click", onClick);
    };
  }, [pathname]);

  return null;
}
