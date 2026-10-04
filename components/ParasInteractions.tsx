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
    let pointsCache: Array<{ slug: string; name: string; zone: string | null; address: string; nearestMetro: string | null; rating: number | null }> | null = null;
    fetch("/points.json").then((r) => r.json()).then((j) => (pointsCache = j)).catch(() => {});
    const slimRow = (slug: string) => {
      const p = pointsCache?.find((x) => x.slug === slug);
      if (!p) return "";
      const zc = ({ north: "#4F46E5", south: "#D90429", east: "#059669" } as any)[p.zone || ""] || "#475569";
      return `
      <div class="flex items-center gap-3 rounded-2xl border border-[#EAD5A0] bg-white p-2.5 shadow-xs hover:border-[#D90429] transition-colors">
        <img src="/idols/durga.png" alt="${p.name}" class="w-11 h-11 rounded-full object-cover border border-[#EAD5A0] shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase tracking-widest text-white" style="background:${zc}">${p.zone || ""}</span>
            <h3 class="font-serif font-bold text-sm text-[#2C1210] truncate">${p.name}</h3>
          </div>
          <p class="text-[11px] text-[#2C1210]/60 truncate">${p.address}${p.nearestMetro ? " · " + p.nearestMetro : ""}</p>
        </div>
        <span class="px-2.5 py-1.5 rounded-full text-xs font-mono font-bold text-[#B45309] bg-amber-50 border border-amber-200 shrink-0">★ ${p.rating ?? "—"}</span>
        <span class="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0">⤴</span>
        <span class="w-8 h-8 rounded-full bg-rose-50 text-[#D90429] flex items-center justify-center font-bold shrink-0">→</span>
      </div>`;
    };
    const toggle = (mode: "grid" | "list") => {
      if (!cardGrid) return;
      if (mode === "list") {
        cardGrid.className = "flex flex-col gap-2";
        cardAnchors().forEach((a) => {
          if (!a.dataset.orig) a.dataset.orig = a.innerHTML;
          const slug = a.getAttribute("href")?.split("/").pop() || "";
          a.innerHTML = slimRow(slug) || a.innerHTML;
          a.classList.remove("group", "block", "h-full");
        });
      } else {
        cardGrid.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5";
        cardAnchors().forEach((a) => {
          if (a.dataset.orig) { a.innerHTML = a.dataset.orig; a.className = "block h-full"; }
        });
      }
      document.body.classList.toggle("paras-list-mode", mode === "list");
    };
    let mode = "grid" as "grid" | "list";
    const paint = () => {
      main.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
        const t = b.innerText.trim();
        if (t === "Grid") {
          b.style.background = mode === "grid" ? "#D90429" : "";
          b.style.color = mode === "grid" ? "#fff" : "";
          b.style.borderColor = mode === "grid" ? "#D90429" : "";
        }
        if (t === "List") {
          b.style.background = mode === "list" ? "#D90429" : "";
          b.style.color = mode === "list" ? "#fff" : "";
          b.style.borderColor = mode === "list" ? "#D90429" : "";
        }
      });
    };
    main.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      const t = b.innerText.trim();
      if (t === "Grid") b.addEventListener("click", () => { mode = "grid"; toggle("grid"); paint(); });
      if (t === "List") b.addEventListener("click", () => { mode = "list"; toggle("list"); paint(); });
    });

    // 4) Suggest / Add goes to upload
    main.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      if (/suggest|add/i.test(b.innerText))
        b.addEventListener("click", () => (location.href = "/upload"));
    });
  }, [pathname]);

  return null;
}
