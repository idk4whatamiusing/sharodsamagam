"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function ClientNav() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest("a");
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href) return;
      if (href.startsWith("/") && !href.startsWith("//") && !el.target) {
        e.preventDefault();
        router.push(href);
      }
    };
    document.addEventListener("click", handler);

    // highlight active nav pill
    const highlight = () => {
      const path = location.pathname.replace(/\/$/, "") || "/";
      document.querySelectorAll<HTMLAnchorElement>("header a[href]").forEach((a) => {
        const href = a.getAttribute("href") || "";
        const div = a.querySelector("div");
        if (!div) return;
        const span = div.querySelector("span:first-of-type") as HTMLElement | null;
        const active = href === "/" ? path === "/" : path.startsWith(href);
        if (active) {
          div.className = "relative px-3.5 sm:px-4.5 py-1 sm:py-1.5 rounded-full bg-gradient-to-b from-[#D90429] via-[#C0041F] to-[#900215] text-white border border-[#FFB800]/70 flex items-center justify-center transition-all duration-300 shadow-xs";
          div.style.background = "";
          if (span) { (span as HTMLElement).style.color = "#fff"; }
        } else {
          div.className = "relative px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full border border-transparent transition-all duration-300 hover:bg-[#D90429] hover:text-white flex items-center justify-center";
          div.style.background = "";
          if (span) { (span as HTMLElement).style.color = ""; }
        }
      });
    };
    highlight();

    // Mobile footer accordions. Each section header owns the panel that
    // follows it (lib/chromeInject grafts the harvested panels in), so the
    // toggle looks at the button's own next sibling - looking at the
    // wrapper's next sibling instead would hide the *following* section.
    // Only buttons whose next sibling IS one of those panels are wired: this
    // selector used to catch every aria-expanded button on the page, and on
    // /paras the sort dropdown (also aria-expanded) got a listener that, on
    // its second click, hid the Grid/List toggle along with it.
    // The wired mark keeps the effect, which re-runs on every navigation,
    // from stacking a second listener that would undo the first.
    document.querySelectorAll<HTMLButtonElement>("button[aria-expanded]").forEach((b) => {
      const next = b.nextElementSibling as HTMLElement | null;
      if (!next?.hasAttribute("data-sheet-panel")) return;
      if (b.dataset.sheetWired === "1") return;
      b.dataset.sheetWired = "1";
      b.addEventListener("click", () => {
        const expanded = b.getAttribute("aria-expanded") === "true";
        b.setAttribute("aria-expanded", expanded ? "false" : "true");
        next.style.display = expanded ? "none" : "";
      });
    });

    // save pandal toggles
    document.querySelectorAll<HTMLButtonElement>('button[aria-label*="Save"]').forEach((b) =>
      b.addEventListener("click", () => {
        const saved = b.dataset.saved === "1";
        b.dataset.saved = saved ? "0" : "1";
        b.style.background = saved ? "" : "#FFF1F2";
        b.style.borderColor = saved ? "" : "#D90429";
      })
    );

    // MORE dropdown. Both the desktop header's MORE and the phone bottom
    // bar's More open it. The old lookup stopped at the first match in
    // document order, which is the desktop button (hidden below lg), so on a
    // phone the visible button did nothing at all. Every matching button is
    // wired, and marked so the effect's re-runs on navigation do not stack a
    // second listener that would undo the first.
    let panel: HTMLElement | null = document.getElementById("our-more-panel");

    const moreBtns = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter(
      (b) => /^more$/i.test((b.textContent || "").trim())
    );

    const paintMore = (open: HTMLButtonElement | null) => {
      moreBtns.forEach((b) => {
        const on = b === open;
        b.style.background = on ? "linear-gradient(to bottom, #D90429, #C0041F, #900215)" : "";
        (b.querySelector("span") as HTMLElement | null)?.style.setProperty("color", on ? "#fff" : "");
        if (b.hasAttribute("aria-expanded")) b.setAttribute("aria-expanded", String(on));
      });
    };
    const closeMore = () => {
      if (!panel) return;
      panel.style.display = "none";
      paintMore(null);
    };
    const toggleMore = (btn: HTMLButtonElement) => {
      if (!panel) return;
      if (panel.style.display === "block") {
        closeMore();
        return;
      }
      panel.style.display = "block";
      paintMore(btn);
    };

    if (!panel) {
      panel = document.createElement("div");
      panel.id = "our-more-panel";
      // max-height + overflow: at 390px the saved-search card and the six
      // destination tiles run past the bottom of the viewport, and the panel
      // must scroll rather than clip.
      panel.style.cssText =
        "position:fixed;top:88px;right:2%;z-index:60;display:none;max-height:calc(100vh - 110px);overflow-y:auto;overscroll-behavior:contain;";
      panel.innerHTML = `
      <div class="w-[720px] max-w-[92vw] rounded-3xl bg-[#1C0D0B] p-[3px] border border-[#E5C880]/60 shadow-[0_20px_60px_-15px_rgba(44,18,16,0.6)]">
        <div class="w-full rounded-[22px] border border-[#D97706] bg-[#2C1210] p-[2px]">
          <div class="w-full rounded-[20px] bg-gradient-to-b from-[#FFFDF9] via-[#FFF9EE] to-[#FFF3D6] p-5 relative overflow-hidden text-[#2C1210]">
            <div class="absolute -right-16 -bottom-16 w-64 h-64 pointer-events-none opacity-10 mix-blend-multiply">
              <img src="/mandela_svg/1331894.svg" alt="" class="w-full h-full object-contain" />
            </div>
            <div class="flex items-center justify-between pb-3 mb-3 border-b border-[#E5C880]/70 relative z-10">
              <div class="flex items-center gap-2"><span class="text-[#D97706] text-xs">❖</span>
                <h3 class="font-serif font-black text-sm uppercase tracking-wider">Festival Heritage & Discovery</h3>
              </div>
              <button id="our-more-close" aria-label="Close menu" class="w-7 h-7 rounded-full bg-[#FFF0F2] border border-[#D90429]/30 text-[#D90429] flex items-center justify-center">✕</button>
            </div>
            <div id="our-more-account" class="mb-3 p-3 rounded-2xl bg-[#FFFDF7] border-2 border-[#E5C880] shadow-2xs relative z-10"></div>
            <div class="mb-3 p-3 rounded-2xl bg-[#FFFDF7] border-2 border-[#E5C880] shadow-2xs relative z-10">
              <div class="flex items-center justify-between gap-3 w-full">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 text-[#D97706] flex items-center justify-center shrink-0">🔖</div>
                  <div class="min-w-0">
                    <h4 class="font-serif font-bold text-xs">Saved Pandals</h4>
                    <p class="text-[10px] text-[#2C1210]/70 font-serif truncate">Your saved pandals, on the directory's Saved tab</p>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <a href="/paras" class="px-3 py-1.5 rounded-xl bg-[#D90429] hover:bg-[#B80322] text-white font-serif font-bold text-xs no-underline">Open Directory</a>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2.5 relative z-10">
              ${[["/points-of-interest","Points of Interest & Metro","Interactive guide to Kolkata transit, heritage spots, & food trails","#B45309","bg-amber-500/10","border-amber-500/30"],
                 ["/chronicles","Puja Chronicles","Centuries of cultural heritage, Dhak lore, & Bonedi Bari archives","#D90429","bg-red-500/10","border-red-500/30"],
                 ["/events","Cultural Events Calendar","Live music recitals, Dhak competitions, & cultural programs","#B45309","bg-amber-500/10","border-amber-500/30"],
                 ["/procession","Immersion & Red Road Carnival","Dashami immersion ghats, Red Road mega carnival passes & routes","#D90429","bg-red-500/10","border-red-500/30"],
                 ["/announcements","Official Bulletins","Live traffic advisories, VIP alerts, & safety announcements","#B45309","bg-amber-500/10","border-amber-500/30"],
                 ["/about-us","About the Portal","The digital gateway celebrating Bengal's greatest cultural festival","#D90429","bg-red-500/10","border-red-500/30"]].map(([h,l,d,c,b1,b2])=>`
              <a href="${h}" class="group flex items-start gap-3 p-2.5 rounded-2xl border bg-white/90 border-[#DECFA6]/80 hover:border-[#D97706] hover:bg-[#FFFDF7] transition-all duration-200 shadow-2xs">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${b1} ${b2}" style="color:${c}">✦</div>
                <div class="flex-1 min-w-0">
                  <h4 class="font-serif font-bold text-xs group-hover:text-[#D90429] transition-colors truncate">${l}</h4>
                  <p class="text-[10.5px] text-[#2C1210]/75 line-clamp-1 mt-0.5 leading-snug">${d}</p>
                </div>
              </a>`).join("")}
            </div>
            <div class="mt-3.5 pt-2.5 border-t border-[#E5C880]/70 flex items-center justify-between text-[10.5px] font-mono text-[#2C1210]/80 relative z-10">
              <div class="flex items-center gap-2">
                <span class="flex items-center gap-1 text-[#D90429] font-bold">📞 24/7 Helpline:</span>
                <a href="tel:100" class="hover:underline font-bold text-[#2C1210]">100</a> ·
                <a href="tel:102" class="hover:underline font-bold text-[#2C1210]">102</a>
              </div>
            </div>
          </div>
        </div>
      </div>`;
      document.body.appendChild(panel);
      panel.querySelector("#our-more-close")?.addEventListener("click", () => closeMore());
      panel.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
        if (!a.getAttribute("href")?.startsWith("/")) return;
        a.addEventListener("click", (e) => {
          const h = a.getAttribute("href");
          if (h && h.startsWith("/")) { e.preventDefault(); closeMore(); router.push(h); }
        });
      });
    }
    moreBtns.forEach((b) => {
      if (b.dataset.moreWired === "1") return;
      b.dataset.moreWired = "1";
      b.addEventListener("click", () => toggleMore(b));
    });

    // Tapping anywhere outside it - or Escape - closes it. At 390px the
    // panel covers most of the viewport, so the More button must not be the
    // only way out.
    const onDocClick = (e: MouseEvent) => {
      if (!panel || panel.style.display !== "block") return;
      const t = e.target as HTMLElement | null;
      if (t && panel.contains(t)) return;
      if (t?.closest("button")?.dataset.moreWired === "1") return;
      closeMore();
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMore();
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeydown);

    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeydown);
    };
  }, [router, pathname]);
  return null;
}
