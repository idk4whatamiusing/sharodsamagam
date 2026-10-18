"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { DAYS_BY_KEY, FESTIVAL_DAYS, type FestivalDay } from "../lib/festivalDays";

/** The panzika dataset stores rites as [label, time] tuples. */
const timingsOf = (d: FestivalDay) =>
  d.rites.map(([label, time]) => ({ label, time }));

const CAL_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" viewBox="0 0 256 256"><path d="M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0v16H68ZM52,204V100h152v104Zm60-80v56a12,12,0,0,1-24,0V143.32a12,12,0,0,1-9.37-22l16-8A12,12,0,0,1,112,124Zm61.49,33.88L163.9,168H168a12,12,0,0,1,0,24H136a12,12,0,0,1-8.71-20.25L155.45,142a4,4,0,0,0,.55-2,12,12,0,0,0-7.47-2,12,12,0,0,1-20.78-12A28,28,0,0,1,180,140a27.77,27.77,0,0,1-5.64,16.86A10.63,10.63,0,0,1,173.49,157.88Z"></path></svg>';

const STAR_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256" class="text-[#D90429]"><path d="M173.79,51.48a221.25,221.25,0,0,0-41.67-34.34,8,8,0,0,0-8.24,0A221.25,221.25,0,0,0,82.21,51.48C54.59,80.48,40,112.47,40,144a88,88,0,0,0,176,0C216,112.47,201.41,80.48,173.79,51.48ZM96,184a8,8,0,0,1-8.53,8A8.09,8.09,0,0,1,84,180.55l.21-.81a8,8,0,0,1,7.72-10h.06a8,8,0,0,1,4.01,14.26ZM168,168a8,8,0,0,1-7.47-8.26V168.27a8,8,0,0,1,7.47-8.26,8,8,0,0,1,8.53,8A8,8,0,0,1,168,168Z"/></svg>';

const CLOCK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256"><path d="M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm0,192a84,84,0,1,1,84-84A84.09,84.09,0,0,1,128,212Zm68-84a12,12,0,0,1-12,12H128a12,12,0,0,1-12-12V72a12,12,0,0,1,24,0v44h44A12,12,0,0,1,196,128Z"/></svg>';

const ACTIVE_TAB =
  'group relative w-full flex-1 min-h-[66px] min-[360px]:min-h-[72px] flex flex-col items-center justify-center rounded-xl p-1 transition-all duration-200 cursor-pointer active:scale-95 text-center border-2 select-none bg-gradient-to-b from-[#D90429] via-[#B90321] to-[#800214] text-white border-[#FFB800] shadow-lg scale-[1.02] z-10';
const IDLE_TAB =
  'group relative w-full flex-1 min-h-[66px] min-[360px]:min-h-[72px] flex flex-col items-center justify-center rounded-xl p-1 transition-all duration-200 cursor-pointer active:scale-95 text-center border-2 select-none bg-[#FFFDF5] border-[#E5C880]/80 text-[#2C1210] hover:bg-[#FFF8EC] hover:border-[#D97706]/60 shadow-xs';
const ARROW =
  '<div class="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#B90321] border-r-2 border-t-2 border-[#FFB800] rotate-45 z-20"></div>';

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Rebuilds the detail panel for a day, matching the scraped Shashthi markup. */
function panelHtml(d: FestivalDay): string {
  const rows = timingsOf(d)
    .map(
      (t) =>
        '<div class="flex items-center justify-between gap-1.5 p-1 min-[360px]:p-1.5 rounded-lg bg-white/95 border border-[#E5C880]/50 text-xs shadow-xs">' +
        // `flex-1 min-w-0` on the wrapper plus `block` (not inline-block) on the
        // span is what makes truncate actually work. With inline-block the span
        // kept its intrinsic width and overlapped the time on the right.
        '<div class="flex-1 min-w-0 overflow-hidden"><span class="block font-serif font-bold text-[10px] min-[360px]:text-[10.5px] text-[#2C1210] truncate">' +
        esc(t.label) +
        "</span></div>" +
        '<p class="text-[8.5px] min-[360px]:text-[9px] font-mono text-[#D97706] font-semibold flex items-center gap-0.5 shrink-0 whitespace-nowrap">' +
        CLOCK_ICON +
        esc(t.time) +
        "</p></div>"
    )
    .join("");

  return (
    // Decorative mandala. Deliberately an <img> rather than a background-image
    // arbitrary utility: Tailwind's scanner treats any such token found in
    // source as a class candidate, and the emitted url() then gets resolved
    // by Turbopack as a module specifier at build time.
    '<img src="/mandela_svg/1331894.svg" alt="" aria-hidden="true" class="absolute -right-10 -bottom-10 w-48 h-48 opacity-20 pointer-events-none mix-blend-multiply object-contain" />' +
    '<div class="relative z-10 space-y-1.5 min-[360px]:space-y-2">' +
    '<div class="flex items-center justify-between gap-1.5 flex-wrap border-b border-[#E5C880]/60 pb-1.5">' +
    '<div class="flex items-center gap-1.5 flex-wrap min-w-0">' +
    '<span class="px-2 py-0.5 rounded-full text-[8.5px] font-mono font-black uppercase tracking-widest bg-[#D90429] text-white border border-[#FFB800] shadow-xs whitespace-nowrap">' +
    esc(d.tithi) +
    "</span>" +
    '<span class="text-[9.5px] font-mono font-bold text-[#D97706] flex items-center gap-1 whitespace-nowrap">' +
    CAL_ICON +
    esc(d.longDate) +
    "</span></div></div>" +
    '<div><h3 class="font-serif font-black text-base min-[360px]:text-lg text-[#2C1210] leading-tight">' +
    esc(d.name) +
    '</h3><p class="text-[10.5px] min-[360px]:text-[11px] font-semibold text-[#D97706] mt-0.5">' +
    esc(d.bnFull) +
    "</p></div>" +
    '<div class="border-l-2 border-[#D90429] pl-2.5 py-0.5">' +
    '<p class="text-[10.5px] min-[360px]:text-xs leading-relaxed text-[#2C1210]/90 font-serif italic line-clamp-2">"' +
    esc(d.desc) +
    '"</p></div>' +
    '<div class="bg-[#FFF8EC] border border-[#E5C880] rounded-xl p-1.5 min-[360px]:p-2 space-y-1 shadow-xs">' +
    '<div class="flex items-center justify-between border-b border-[#E5C880]/50 pb-1">' +
    '<div class="flex items-center gap-1 text-[10.5px] min-[360px]:text-[11px] font-mono font-black uppercase tracking-wider text-[#2C1210]">' +
    STAR_ICON +
    "<span>Main Timings</span></div></div>" +
    '<div class="grid grid-cols-1 gap-1 min-[360px]:gap-1.5">' +
    rows +
    "</div></div></div>"
  );
}

export default function FestivalDays() {
  // Re-bind on every route change; the layout outlives the page children.
  const pathname = usePathname();

  useEffect(() => {
    const panel = document.querySelector<HTMLElement>("[data-fday-panel]");
    const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-fday]"));
    if (!panel || !tabs.length) return;

    // Every day renders through panelHtml() from the shared dataset, so the
    // home page and /panzika can never drift apart.
    const select = (key: string) => {
      const day = DAYS_BY_KEY[key as FestivalDay["key"]];
      if (!day) return;

      panel.innerHTML = panelHtml(day);

      tabs.forEach((tab) => {
        const isActive = tab.dataset.fday === key;
        // Each tab carries its own day's label. Reading `day` (the selected
        // one) here rewrote every tab to the same text the moment select()
        // ran, which left six identical tabs reading "Oct 16 Shashthi".
        const own = tab.dataset.fday
          ? DAYS_BY_KEY[tab.dataset.fday as FestivalDay["key"]]
          : undefined;
        if (!own) return;

        tab.className = isActive ? ACTIVE_TAB : IDLE_TAB;
        const existingArrow = tab.querySelector(":scope > div");
        if (isActive && !existingArrow) tab.insertAdjacentHTML("afterbegin", ARROW);
        if (!isActive && existingArrow) existingArrow.remove();

        const dateEl = tab.querySelector("span");
        const nameEl = tab.querySelectorAll("span")[1];
        const bnEl = tab.querySelectorAll("span")[2];
        if (dateEl) {
          dateEl.textContent = own.tabDate;
          dateEl.className =
            "text-[7px] min-[360px]:text-[7.5px] font-mono font-black uppercase tracking-wider " +
            (isActive ? "text-[#FFB800]" : "text-[#D97706]");
        }
        if (nameEl) {
          nameEl.textContent = own.name
            .replace(/^Maha /, "")
            .replace("Vijaya Dashami", "Dashami");
          nameEl.className =
            "font-serif font-black text-[11px] min-[360px]:text-xs leading-tight mt-0.5 " +
            (isActive
              ? "text-white drop-shadow-sm"
              : "text-[#2C1210]");
        }
        if (bnEl) {
          bnEl.textContent = own.bnFull.split(" · ")[1] ?? own.bnFull;
          bnEl.className =
            "text-[7px] font-semibold tracking-tight mt-0.5 truncate max-w-[66px] " +
            (isActive ? "text-amber-200" : "text-[#2C1210]/60");
        }

        tab.setAttribute("aria-selected", String(isActive));
      });
    };

    const onClick = (e: Event) => {
      const tab = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-fday]");
      if (!tab?.dataset.fday) return;
      select(tab.dataset.fday);
    };

    tabs.forEach((t) => t.addEventListener("click", onClick));

    // Normalise the server-rendered state through the same code path so the
    // first paint and every later click agree.
    select(FESTIVAL_DAYS[0].key);

    return () => tabs.forEach((t) => t.removeEventListener("click", onClick));
  }, [pathname]);

  return null;
}