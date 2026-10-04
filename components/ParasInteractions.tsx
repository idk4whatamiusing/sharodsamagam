"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ParasInteractions() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname.startsWith("/paras")) return;
    const main = document.querySelector("main");
    if (!main) return;

    const cardAnchors = () =>
      Array.from(main!.querySelectorAll<HTMLAnchorElement>('a[href^="/paras/"]'));
    const cardContainer = () => {
      const first = cardAnchors()[0];
      return first ? (first.parentElement as HTMLElement | null) : null;
    };

    // 1) Search box filters cards live
    const search = main.querySelector<HTMLInputElement>(
      'input[placeholder*="Search pandal"]'
    );
    search?.addEventListener("input", () => {
      const q = search.value.toLowerCase().trim();
      cardAnchors().forEach((a) => {
        a.style.display = !q || a.innerText.toLowerCase().includes(q) ? "" : "none";
      });
    });

    // 2) Zone chips (All/North/South/...) inside the chips row
    const chipsRow = Array.from(main.querySelectorAll("button"))
      .map((b) => b.parentElement)
      .find(
        (p) =>
          p &&
          Array.from(p.children).filter((c) => c.tagName === "BUTTON").length >= 5 &&
          /border-t/.test(p!.className)
      );
    chipsRow?.querySelectorAll<HTMLButtonElement>("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const zone = btn.innerText.trim().toLowerCase();
        cardAnchors().forEach((a) => {
          const badge = a.querySelector("span");
          const z = (badge?.textContent || "").trim().toLowerCase();
          a.style.display =
            zone === "all" || (z && zone.startsWith(z)) ? "" : "none";
        });
      });
    });

    // 3) Grid / List toggle switches the card container layout
    const cardGrid = cardContainer();
    const toggle = (mode: "grid" | "list") => {
      if (!cardGrid) return;
      cardGrid.className =
        mode === "list"
          ? "flex flex-col gap-3"
          : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6";
    };
    main.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      const t = b.innerText.trim();
      if (t === "Grid") b.addEventListener("click", () => toggle("grid"));
      if (t === "List") b.addEventListener("click", () => toggle("list"));
    });

    // 4) Suggest / Add goes to upload
    main.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      if (/suggest|add/i.test(b.innerText))
        b.addEventListener("click", () => (location.href = "/upload"));
    });
  }, [pathname]);

  return null;
}
