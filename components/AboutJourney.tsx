"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import days from "../data/about-days.json";

/**
 * Revives the About page's "Ritual Journey" day tabs.
 *
 * The original keeps all six days in its client component and shows the one
 * whose tab is pressed; the server HTML carries only that one day. The other
 * five panels, plus the original's own active/inactive button classes, are in
 * data/about-days.json (see lib/aboutInject.ts for how the slots are marked).
 *
 * Swapping the panel's inner HTML inside the existing gradient frame keeps
 * the page's own markup, down to the frame's classes.
 */

export default function AboutJourney() {
  // Re-scan on navigation; the layout outlives the page children.
  const pathname = usePathname();

  useEffect(() => {
    const tabs = document.querySelector<HTMLElement>("[data-about-tabs]");
    const panel = document.querySelector<HTMLElement>("[data-about-panel]");
    if (!tabs || !panel) return;

    const buttons = Array.from(tabs.querySelectorAll<HTMLElement>("[data-about-day]"));
    if (!buttons.length) return;

    const show = (day: string) => {
      const entry = days.days.find((d) => d.day === day);
      if (!entry) return;
      for (const b of buttons) {
        b.className = b.dataset.aboutDay === day ? days.activeClass : days.inactiveClass;
      }
      panel.innerHTML = entry.html;
    };

    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLElement>("[data-about-day]");
      if (!button || !tabs.contains(button) || !button.dataset.aboutDay) return;
      show(button.dataset.aboutDay);
    };

    tabs.addEventListener("click", onClick);
    return () => tabs.removeEventListener("click", onClick);
  }, [pathname]);

  return null;
}
