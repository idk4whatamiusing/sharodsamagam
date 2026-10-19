"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Revives the Points of Interest directory's search box and category chips.
 *
 * Both are React state on the original and were frozen shut in the scrape.
 * lib/poiInject renders all 273 places into the grid (data/pois.json, harvested
 * by scripts/harvest-pois.mjs) and marks the input, the chip row, the grid and
 * every card; this component does the filtering.
 *
 * The matching rule is the original's own: a card is shown when the typed text
 * is contained in its name or address, and when the selected chip is "all" or
 * the card's category. The empty state and the chip classes are the
 * original's, captured by the harvest.
 */

export default function PoiSearch() {
  // Re-scan on navigation; the layout outlives the page children.
  const pathname = usePathname();

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>("[data-poi-search]");
    const chipRow = document.querySelector<HTMLElement>("[data-poi-chips]");
    const grid = document.querySelector<HTMLElement>("[data-poi-grid]");
    const empty = document.querySelector<HTMLElement>("[data-poi-empty]");
    const reset = document.querySelector<HTMLElement>("[data-poi-reset]");
    if (!input || !grid) return;

    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-poi-card]"));
    const chips = chipRow
      ? Array.from(chipRow.querySelectorAll<HTMLElement>("[data-poi-cat]"))
      : [];
    const activeClass = chipRow?.dataset.activeClass ?? "";
    const inactiveClass = chipRow?.dataset.inactiveClass ?? "";
    let category = "all";

    const apply = () => {
      const query = input.value.trim().toLowerCase();
      let shown = 0;
      for (const card of cards) {
        const byCategory = category === "all" || card.dataset.poiCat === category;
        const byText = !query || (card.dataset.poiKey ?? "").includes(query);
        const visible = byCategory && byText;
        card.hidden = !visible;
        if (visible) shown += 1;
      }
      if (empty) empty.hidden = shown > 0;
    };

    const select = (id: string) => {
      category = id;
      for (const chip of chips) {
        const pressed = chip.dataset.poiCat === id;
        if (activeClass && inactiveClass) {
          chip.className = pressed ? activeClass : inactiveClass;
        }
      }
    };

    const onChipClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const chip = target?.closest<HTMLElement>("[data-poi-cat]");
      if (!chip || !chip.dataset.poiCat) return;
      select(chip.dataset.poiCat);
      apply();
    };

    const onReset = () => {
      input.value = "";
      select("all");
      apply();
    };

    input.addEventListener("input", apply);
    chipRow?.addEventListener("click", onChipClick);
    reset?.addEventListener("click", onReset);

    return () => {
      input.removeEventListener("input", apply);
      chipRow?.removeEventListener("click", onChipClick);
      reset?.removeEventListener("click", onReset);
    };
  }, [pathname]);

  return null;
}
