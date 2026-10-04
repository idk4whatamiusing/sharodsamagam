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
      panel.style.cssText = "position:fixed;top:64px;right:12px;z-index:60;display:none;";
      panel.innerHTML = `<div style="background:#fff;border:1px solid #EAD5A0;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.15);padding:8px 0;min-width:200px;font-size:13px;">
        ${[["/events","Event Calendar"],["/points-of-interest","Points of Interest"],["/procession","Immersion Carnival"],["/connect","Social Wall & Feed"],["/announcements","Official Bulletin"],["/about-us","About"],["/copyright","Copyright & Takedowns"]].map(([h,l])=>`<a href="${h}" data-more-link style="display:block;padding:8px 16px;font-family:serif;font-weight:bold;color:#2C1210;">${l}</a>`).join("")}
      </div>`;
      document.body.appendChild(panel);
      panel.querySelectorAll("a[data-more-link]").forEach((a) =>
        a.addEventListener("click", (e) => {
          e.preventDefault();
          panel!.style.display = "none";
          router.push((a as HTMLAnchorElement).getAttribute("href") || "/");
        })
      );
    }
    const togglePanel = () => {
      if (!panel) return;
      panel.style.display = panel.style.display === "block" ? "none" : "block";
    };
    moreBtn?.addEventListener("click", togglePanel);

    return () => {
      document.removeEventListener("click", handler);
      moreBtn?.removeEventListener("click", togglePanel);
    };
  }, [router, pathname]);
  return null;
}
