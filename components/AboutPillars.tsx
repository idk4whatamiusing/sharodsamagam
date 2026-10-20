"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import pillars from "../data/about-pillars.json";

export default function AboutPillars() {
  const pathname = usePathname();

  useEffect(() => {
    const tabs = document.querySelector<HTMLElement>("[data-pillar-tabs]");
    const panel = document.querySelector<HTMLElement>("[data-pillar-panel]");
    if (!tabs || !panel) return;

    const buttons = Array.from(tabs.querySelectorAll<HTMLElement>("[data-pillar]"));
    if (!buttons.length) return;

    /**
     * The pressed tab's own title and label carry colour classes of their own
     * (`text-amber-200` / `text-amber-400` when pressed, `text-[#2C1210]` /
     * `text-[#B45309]` when not), so swapping the button's class list alone
     * leaves the label of the previously pressed tab yellow. The state is
     * therefore also published on the button, and the label colours are driven
     * from CSS in app/globals.css.
     */
    const paint = (button: HTMLElement, active: boolean) => {
      button.dataset.pillarActive = active ? "true" : "false";
      const spans = button.querySelectorAll<HTMLElement>("span");
      const title = spans[0];
      const label = spans[1];
      if (title) title.classList.add("pillar-title");
      if (label) label.classList.add("pillar-label");
    };

    const show = (pillar: string) => {
      const entry = pillars.days.find((d) => d.day === pillar);
      if (!entry) return;
      for (const b of buttons) {
        const active = b.dataset.pillar === pillar;
        b.className = active ? pillars.activeClass : pillars.inactiveClass;
        paint(b, active);
      }
      panel.innerHTML = entry.html;
    };

    // The server-rendered markup carries its own pressed button class, so the
    // pressed tab is found by the dark card it was rendered with.
    for (const b of buttons) {
      paint(b, b.className.includes("bg-[#1C0D0B]"));
    }

    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLElement>("[data-pillar]");
      if (!button || !tabs.contains(button) || !button.dataset.pillar) return;
      show(button.dataset.pillar);
    };

    tabs.addEventListener("click", onClick);
    return () => tabs.removeEventListener("click", onClick);
  }, [pathname]);

  return null;
}
