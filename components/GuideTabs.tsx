"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Revives the guide index's topic tabs.
 *
 * The original shows one topic at a time behind five pills; the static scrape
 * kept only the panel that happened to be server-rendered, so four of the
 * pills did nothing. data/guide-tabs.json holds the other four panels (see
 * lib/guideInject.ts for how the slots are marked), and this swaps between
 * the marked panels rather than replacing innerHTML, so the transit map in
 * the first one is never detached.
 *
 * The pills' pressed and unpressed classes come from the markup itself: the
 * mirror ships the original's own server-rendered state - the first pill lit,
 * the other four not - so the two looks are snapshotted on arrival. Importing
 * the harvest here would pull its 100 KB of panel HTML into the client
 * bundle for two class strings that are already in the page.
 */

export default function GuideTabs() {
  // Re-scan on navigation; the layout outlives the page children.
  const pathname = usePathname();

  useEffect(() => {
    const row = document.querySelector<HTMLElement>("[data-guide-tabs]");
    const buttons = row
      ? Array.from(row.querySelectorAll<HTMLButtonElement>("[data-guide-tab]"))
      : [];
    const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-guide-panel]"));
    if (!row || buttons.length < 2 || panels.length < 2) return;

    const shownLabel = () =>
      panels.find((p) => p.style.display !== "none")?.dataset.guidePanel || "";
    const buttonFor = (label: string) => buttons.find((b) => b.dataset.guideTab === label);

    const litPill = buttonFor(shownLabel()) || buttons[0];
    const dimPill = buttons.find((b) => b !== litPill) || buttons[0];
    const onClass = litPill.className;
    const offClass = dimPill.className;

    const show = (label: string) => {
      for (const b of buttons) {
        b.className = b.dataset.guideTab === label ? onClass : offClass;
      }
      for (const p of panels) {
        p.style.display = p.dataset.guidePanel === label ? "" : "none";
      }
    };

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      const btn = t?.closest<HTMLElement>("[data-guide-tab]");
      if (!btn || !row.contains(btn)) return;
      const label = btn.dataset.guideTab;
      if (label) show(label);
    };
    row.addEventListener("click", onClick);
    return () => row.removeEventListener("click", onClick);
  }, [pathname]);

  return null;
}
