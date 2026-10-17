"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// All times are midnight in Asia/Kolkata, matching how the rest of the
// festival schedule is expressed.
const MAHALAYA = Date.parse("2026-10-10T00:00:00+05:30");
const SHASHTHI = Date.parse("2026-10-16T00:00:00+05:30");
const DASHAMI = Date.parse("2026-10-21T00:00:00+05:30");
const SIX_DAYS = ["", "Mahalaya", "Maha Shashthi", "Maha Saptami", "Maha Ashtami", "Maha Nabami", "Vijaya Dashami"];

function daysUntil(a: number, b: number) {
  // Rounds up: three days before Mahalaya should read "3 Days to Mahalaya",
  // not "2".
  return Math.ceil((b - a) / 86400000);
}

/**
 * Zero-based index of the Devi Paksha day, or -1 outside the festival.
 *
 * Uses floor, not ceil: Shashthi begins at midnight on the 16th, so any
 * moment on the 17th is still day two of six. Ceil would flip the label to
 * "Day 3" for the whole second day.
 */
function festivalDay(now: number) {
  const idx = Math.floor((now - SHASHTHI) / 86400000);
  return idx >= 0 && idx <= 5 ? idx : -1;
}

/**
 * Replaces the scraped, permanently-stale "8 Days to Mahalaya" pill with a
 * phase-aware line. The scraped number was baked at crawl time and could
 * never be right again.
 */
function phaseText(now: number): string {
  const day = festivalDay(now);
  if (day >= 0) return `Day ${day + 1} of 6 · ${SIX_DAYS[day + 2]}`;
  if (now < MAHALAYA) return `${daysUntil(now, MAHALAYA)} Days to Mahalaya`;
  if (now < SHASHTHI) return `${daysUntil(now, SHASHTHI)} days to Maha Shashthi`;
  return "Bijoya · Sharodotsav 2026 has concluded";
}

export default function FestivalStatus() {
  // Re-scan on navigation; the layout outlives the page children.
  const pathname = usePathname();

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-mahalaya-status]"));
    if (!els.length) return;

    const paint = () => {
      const text = phaseText(Date.now());
      els.forEach((el) => {
        if (el.textContent !== text) el.textContent = text;
      });
    };
    paint();

    // Re-evaluate at midnight so a long-lived tab doesn't sit on a stale day.
    const id = window.setInterval(paint, 60_000);
    return () => window.clearInterval(id);
  }, [pathname]);

  return null;
}