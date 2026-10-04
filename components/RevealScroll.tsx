"use client";

import { useEffect } from "react";

export default function RevealScroll() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
            el.style.transition = "opacity .7s ease, transform .7s ease";
            io.unobserve(el);
          }
        }
      },
      { threshold: 0.1 }
    );
    const scan = () =>
      document
        .querySelectorAll<HTMLElement>("[style*='opacity:0']")
        .forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
  return null;
}
