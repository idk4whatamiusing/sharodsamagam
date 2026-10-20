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

    const show = (pillar: string) => {
      const entry = pillars.days.find((d) => d.day === pillar);
      if (!entry) return;
      for (const b of buttons) {
        b.className = b.dataset.pillar === pillar ? pillars.activeClass : pillars.inactiveClass;
      }
      panel.innerHTML = entry.html;
    };

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
