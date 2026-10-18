"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Maha Shashthi, Friday 16 October 2026, 00:00 in Asia/Kolkata.
// Mahalaya (10 Oct) has already passed by the time this ships, so counting
// down to it would render a negative clock.
const TARGET_ISO = "2026-10-16T00:00:00+05:30";
const TARGET_MS = new Date(TARGET_ISO).getTime();

const CAL_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" viewBox="0 0 256 256"><path d="M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0v16H68ZM52,204V100h152v104Z"/></svg>';

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function Countdown() {
  // The layout survives client-side navigation, so this must re-scan for
  // its slot whenever the route changes — not just on the first page load.
  const pathname = usePathname();

  useEffect(() => {
    const slots = Array.from(
      document.querySelectorAll<HTMLElement>("[data-countdown-slot]")
    );
    if (!slots.length) return;

    let raf = 0;
    let timer = 0;
    let lastSecond = -1;

    const paint = (now: number) => {
      const remaining = TARGET_MS - now;

      if (remaining <= 0) {
        slots.forEach((slot) => {
          slot.innerHTML =
            '<div class="py-2 text-center">' +
            '<p class="font-serif font-black text-sm text-[#FFB800] leading-tight">Sharodsamagam 2026 is live</p>' +
            '<p class="text-[8px] text-amber-200/50 font-mono pt-0.5">Maa Durga has arrived</p>' +
            "</div>";
        });
        return false;
      }

      const { d, h, m, s } = parts(remaining);
      // Repainting once a second keeps layout thrash off the main thread.
      if (s === lastSecond) return true;
      lastSecond = s;

      const cells: [string, string][] = [
        [String(d), "Days"],
        [pad(h), "Hours"],
        [pad(m), "Mins"],
        [pad(s), "Secs"],
      ];

      slots.forEach((slot) => {
        slot.innerHTML =
          '<div class="flex items-center justify-between sm:justify-around py-1">' +
          cells
            .map(
              ([v, l]) =>
                '<div class="flex flex-col items-center gap-1">' +
                '<div class="w-8 sm:w-12 h-6 sm:h-8 rounded bg-white/10 flex items-center justify-center">' +
                `<span class="font-mono font-black text-sm sm:text-base text-[#FFB800] tabular-nums">${v}</span>` +
                "</div>" +
                `<div class="w-6 sm:w-8 h-2.5 rounded bg-white/5 flex items-center justify-center">` +
                `<span class="text-[6.5px] sm:text-[7px] uppercase tracking-wider font-mono font-bold text-amber-100/60 leading-none">${l}</span>` +
                "</div></div>"
            )
            .join("") +
          "</div>" +
          `<p class="text-[8px] text-amber-200/50 font-mono pt-0.5 flex items-center justify-center gap-1">${CAL_ICON}Maha Shashthi · 16 Oct</p>`;
      });
      return true;
    };

    const tick = () => {
      raf = requestAnimationFrame(() => {
        if (paint(Date.now())) timer = window.setTimeout(tick, 200);
      });
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}