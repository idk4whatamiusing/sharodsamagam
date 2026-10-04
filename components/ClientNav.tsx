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

    // footer More-accordion toggles
    document.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]').forEach((b) => {
      if (b.closest("nav") || b.id === "kolkata-map" || b.id === "pandal-map") return;
      b.addEventListener("click", () => {
        const next = b.parentElement?.nextElementSibling as HTMLElement | null ?? b.nextElementSibling as HTMLElement | null;
        const expanded = b.getAttribute("aria-expanded") === "true";
        b.setAttribute("aria-expanded", expanded ? "false" : "true");
        if (next) next.style.display = expanded ? "none" : "";
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

    // MORE dropdown
    const moreBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => /more/i.test(b.textContent || "") && b.closest("nav") !== null || b.getAttribute("aria-label")?.includes("more")
    );
    let panel: HTMLElement | null = document.getElementById("our-more-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "our-more-panel";
      panel.style.cssText = "position:fixed;top:88px;right:2%;z-index:60;display:none;";
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
            <div class="mb-3 p-3 rounded-2xl bg-[#FFFDF7] border-2 border-[#E5C880] shadow-2xs relative z-10">
              <div class="flex items-center justify-between gap-3 w-full">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 text-[#D97706] flex items-center justify-center shrink-0">👤</div>
                  <div class="min-w-0">
                    <h4 class="font-serif font-bold text-xs">Visitor Profile</h4>
                    <p class="text-[10px] text-[#2C1210]/70 font-serif truncate">Sign in with Google to save pandals</p>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <a href="/profile" class="px-2.5 py-1.5 rounded-xl bg-[#FFF3D6] hover:bg-[#FFEAB8] border border-[#E5C880] font-serif font-bold text-xs no-underline">My Routes</a>
                  <a href="/login" class="px-3 py-1.5 rounded-xl bg-[#D90429] hover:bg-[#B80322] text-white font-serif font-bold text-xs no-underline">Sign In</a>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2.5 relative z-10">
              ${[["/points-of-interest","Points of Interest & Metro","Interactive guide to Kolkata transit, heritage spots, & food trails","#0284C7","bg-sky-500/10","border-sky-500/30"],
                 ["/chronicles","Puja Chronicles","Centuries of cultural heritage, Dhak lore, & Bonedi Bari archives","#D97706","bg-amber-500/10","border-amber-500/30"],
                 ["/events","Cultural Events Calendar","Live music recitals, Dhak competitions, & cultural programs","#7C3AED","bg-purple-500/10","border-purple-500/30"],
                 ["/procession","Immersion & Red Road Carnival","Dashami immersion ghats, Red Road mega carnival passes & routes","#059669","bg-emerald-500/10","border-emerald-500/30"],
                 ["/announcements","Official Bulletins","Live traffic advisories, VIP alerts, & safety announcements","#E11D48","bg-rose-500/10","border-rose-500/30"],
                 ["/about-us","About the Portal","The digital gateway celebrating Bengal's greatest cultural festival","#B45309","bg-amber-600/10","border-amber-600/30"]].map(([h,l,d,c,b1,b2])=>`
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
      panel.querySelector("#our-more-close")?.addEventListener("click", () => (panel!.style.display = "none"));
      panel.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
        if (!a.getAttribute("href")?.startsWith("/")) return;
        a.addEventListener("click", (e) => {
          const h = a.getAttribute("href");
          if (h && h.startsWith("/")) { e.preventDefault(); panel!.style.display = "none"; router.push(h); }
        });
      });
    }
    const togglePanel = () => {
      if (!panel) return;
      const open = panel.style.display === "block";
      panel.style.display = open ? "none" : "block";
      if (moreBtn) moreBtn.style.background = open ? "" : "linear-gradient(to bottom, #D90429, #C0041F, #900215)";
      if (moreBtn) (moreBtn.querySelector("span") as HTMLElement | null)?.style.setProperty("color", open ? "" : "#fff");
    };
    moreBtn?.addEventListener("click", togglePanel);

    return () => {
      document.removeEventListener("click", handler);
      moreBtn?.removeEventListener("click", togglePanel);
    };
  }, [router, pathname]);
  return null;
}
