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
          div.style.background = "#D90429";
          div.style.borderColor = "#D90429";
          if (span) span.style.color = "#fff";
        } else {
          div.style.background = "";
          div.style.borderColor = "";
          if (span) span.style.color = "";
        }
      });
    };
    highlight();
    return () => {
      document.removeEventListener("click", handler);
    };
  }, [router, pathname]);
  return null;
}
