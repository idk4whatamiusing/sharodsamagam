"use client";

import { useEffect } from "react";

export default function ParasInteractions() {
  useEffect(() => {
    if (!location.pathname.startsWith("/paras")) return;

    // search filter
    const search = document.querySelector<HTMLInputElement>(
      'input[placeholder*="Search pandal"]'
    );
    const cards = () =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/paras/"]'));
    const applySearch = () => {
      const q = (search?.value || "").toLowerCase().trim();
      cards().forEach((a) => {
        const t = a.innerText.toLowerCase();
        a.style.display = !q || t.includes(q) ? "" : "none";
      });
    };
    search?.addEventListener("input", applySearch);

    // zone filter chips
    const zoneWrap = document.querySelector(".pt-1\\.5.border-t");
    zoneWrap?.querySelectorAll<HTMLButtonElement>("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const zone = (btn.innerText || "").trim().toLowerCase();
        document.querySelectorAll<HTMLElement>("article").forEach((art) => {
          const badge = art.querySelector("span");
          const z = (badge?.textContent || "").toLowerCase();
          art.closest<HTMLElement>("a")!.style.display =
            zone === "all" || zone.startsWith(z) ? "" : "none";
        });
      });
    });

    // grid / list toggle
    const toggleButtons = Array.from(document.querySelectorAll("button")).filter(
      (b) => b.innerText.trim() === "Grid" || b.innerText.trim() === "List"
    );
    const container = document.querySelector("div.grid");
    toggleButtons.forEach((btn) =>
      btn.addEventListener("click", () => {
        if (!container) return;
        if (btn.innerText.trim() === "List") {
          container.className = "flex flex-col gap-3";
        } else {
          container.className =
            "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6";
        }
      })
    );

    // Add/Suggest button -> go to upload
    Array.from(document.querySelectorAll("button"))
      .filter((b) => /suggest|add/i.test(b.innerText))
      .forEach((b) =>
        b.addEventListener("click", () => (location.href = "/upload"))
      );
  }, []);

  return null;
}
