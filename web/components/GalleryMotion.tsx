"use client";

import { useEffect } from "react";

export default function GalleryMotion() {
  useEffect(() => {
    const handler = () => {
      document
        .querySelectorAll<HTMLElement>("div.flex.flex-col.will-change-transform")
        .forEach((col) => {
          if (col.dataset.animated) return;
          col.dataset.animated = "1";
          col.innerHTML += col.innerHTML; // duplicate for seamless loop
          col.style.animation = `scrollCol ${Math.max(30, col.scrollHeight / 40)}s linear infinite`;
        });
    };
    handler();
    const mo = new MutationObserver(handler);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
