"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { FESTIVAL_DAYS } from "../lib/festivalDays";

// All times are midnight in Asia/Kolkata, matching how the rest of the
// festival schedule is expressed.
const MAHALAYA = Date.parse("2026-10-10T00:00:00+05:30");
const SHASHTHI = Date.parse("2026-10-16T00:00:00+05:30");

function daysUntil(a: number, b: number) {
  // Rounds up: three days before Mahalaya should read "3 Days to Mahalaya",
  // not "2".
  return Math.ceil((b - a) / 86400000);
}

/**
 * Zero-based index of the Devi Paksha day, or -1 outside the festival.
 *
 * Uses floor, not ceil: Shashthi begins at midnight on the 16th, so any
 * moment on the 17th is still that festival day. Ceil would flip the label a
 * day early.
 *
 * The index is then looked up in FESTIVAL_DAYS rather than matched against a
 * hand-written list of names. The old list was written for the five-day model
 * where Saptami covered the 17th and 18th together, so on the 18th it named
 * the day "Maha Ashtami" - a day early. Splitting Saptami in two made the
 * dataset six entries long, which is exactly one entry per date from the
 * 16th to the 21st, so the index lines up with the table by construction.
 */
function festivalDay(now: number) {
  const idx = Math.floor((now - SHASHTHI) / 86400000);
  return idx >= 0 && idx < FESTIVAL_DAYS.length ? idx : -1;
}

/**
 * Replaces the scraped, permanently-stale "8 Days to Mahalaya" pill with a
 * phase-aware line. The scraped number was baked at crawl time and could
 * never be right again.
 */
function phaseText(now: number): string {
  const day = festivalDay(now);
  if (day >= 0) {
    const d = FESTIVAL_DAYS[day];
    return `Day ${day + 1} of ${FESTIVAL_DAYS.length} · ${d.name}`;
  }
  if (now < MAHALAYA) return `${daysUntil(now, MAHALAYA)} Days to Mahalaya`;
  if (now < SHASHTHI) return `${daysUntil(now, SHASHTHI)} days to Maha Shashthi`;
  return "Bijoya · Sharodsamagam 2026 has concluded";
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