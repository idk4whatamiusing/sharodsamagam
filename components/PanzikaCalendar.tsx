"use client";

import { useState } from "react";
import {
  ALMANAC,
  PANZIKA_BY_DAY,
  PANZIKA_DAYS,
  type PanzikaKey,
} from "../lib/panzikaData";

/**
 * October 2026, first a Sunday. Oct 1 2026 is a Thursday, so the grid opens
 * on a 4-day offset.
 */
const FIRST_WEEKDAY = 4;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TOTAL_DAYS = 31;

/** The day the panel opens on: today if it is a festival day, else Mahalaya. */
function initialKey(): PanzikaKey {
  const today = new Date();
  const key =
    today.getFullYear() === 2026 && today.getMonth() === 9
      ? PANZIKA_BY_DAY[today.getDate()]
      : undefined;
  return key ?? "mahalaya";
}

/**
 * Maha Saptami runs across two days, so its bare tithi name appears twice and
 * two tabs would read identically. Number them the way the original does.
 */
const LABELLED = (() => {
  const totals = new Map<string, number>();
  for (const d of PANZIKA_DAYS) totals.set(d.enName, (totals.get(d.enName) ?? 0) + 1);
  const seen = new Map<string, number>();
  const labels = new Map<PanzikaKey, string>();
  for (const d of PANZIKA_DAYS) {
    const n = (seen.get(d.enName) ?? 0) + 1;
    seen.set(d.enName, n);
    labels.set(
      d.key,
      (totals.get(d.enName) ?? 0) > 1 ? `${d.enName} (${n})` : d.enName
    );
  }
  return labels;
})();

/** The formal Bengali name, e.g. "মহাসপ্তমী ২" - the subtitle's first half. */
const bnFormal = (d: (typeof PANZIKA_DAYS)[number]) =>
  d.subtitleBn.split(" · ")[0] ?? d.bnName;

export default function PanzikaCalendar() {
  const [selected, setSelected] = useState<PanzikaKey>(initialKey);
  const [view, setView] = useState<"calendar" | "almanac">("calendar");

  const day = PANZIKA_DAYS.find((d) => d.key === selected) ?? PANZIKA_DAYS[0];

  const cells: (number | null)[] = [
    ...Array.from({ length: FIRST_WEEKDAY }, () => null),
    ...Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1),
  ];

  return (
    <div>
      {/* View switch + print */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Panzika view"
          className="inline-flex rounded-full border border-[#E5C880] bg-white p-1 shadow-sm"
        >
          <ViewTab
            active={view === "calendar"}
            onClick={() => setView("calendar")}
          >
            Interactive Calendar View
          </ViewTab>
          <ViewTab active={view === "almanac"} onClick={() => setView("almanac")}>
            Traditional Almanac Table
          </ViewTab>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-[#2C1210] px-4 py-2 text-xs font-mono font-black uppercase tracking-widest text-white transition-colors hover:bg-[#D90429] print:hidden"
        >
          Print Panzika
        </button>
      </div>

      {view === "calendar" ? (
        <>
          {/* Quick selector.

            Seven festival days want seven columns on desktop. That is set in
            app/globals.css under `[data-day-strip]` rather than with
            `lg:grid-cols-7`: the original site's compiled theme is loaded
            after our Tailwind output and re-declares the same utilities, and
            the arbitrary-property variants sort below the base utility inside
            Tailwind's own cascade layer, so utility classes on this element
            lose. An attribute selector outranks them on specificity. */}
          <div
            role="tablist"
            aria-label="Festival days"
            data-day-strip
            className="mt-5 grid gap-2"
          >
            {PANZIKA_DAYS.map((d) => {
              const active = d.key === selected;
              return (
                <button
                  key={d.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-pday={d.key}
                  onClick={() => setSelected(d.key)}
                  className={
                    "rounded-xl border px-3 py-2 text-left transition-all " +
                    (active
                      ? "border-[#FFB800] bg-gradient-to-b from-[#D90429] to-[#800214] text-white shadow-lg"
                      : "border-[#E5C880] bg-[#FFFDF5] text-[#2C1210] hover:border-[#D97706]/60 hover:bg-[#FFF8EC]")
                  }
                >
                  <span
                    className={
                      "block text-[10px] font-mono font-black uppercase tracking-wider " +
                      (active ? "text-[#FFB800]" : "text-[#D97706]")
                    }
                  >
                    {d.day} Oct
                  </span>
                  <span className="mt-0.5 block font-serif text-sm font-black leading-tight">
                    {LABELLED.get(d.key)}
                  </span>
                  <span
                    className={
                      "mt-0.5 block font-serif text-[11px] " +
                      (active ? "text-amber-100" : "text-[#2C1210]/70")
                    }
                  >
                    {bnFormal(d)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* October 2026 grid */}
          <section className="mt-6 rounded-3xl border border-[#EAD5A0] bg-white p-4 sm:p-6">
            <h2 className="font-serif text-xl font-black">
              October 2026 <span className="text-[#D97706]">·</span>{" "}
              <span className="font-sans text-sm font-bold text-[#2C1210]/60">
                Devi Paksha Fortnight
              </span>
            </h2>

            <div className="mt-4 grid grid-cols-7 gap-1.5 text-center">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="pb-1 text-[10px] font-mono font-black uppercase tracking-wider text-[#2C1210]/50"
                >
                  {w}
                </div>
              ))}

              {cells.map((n, i) => {
                if (n === null)
                  return <div key={`pad-${i}`} className="min-h-[56px] sm:min-h-[72px]" />;

                const key = PANZIKA_BY_DAY[n];
                const marker = key
                  ? PANZIKA_DAYS.find((d) => d.key === key)!
                  : null;
                const active = key === selected;

                return (
                  <button
                    key={n}
                    type="button"
                    disabled={!key}
                    aria-pressed={key ? active : undefined}
                    data-gridday={n}
                    onClick={() => key && setSelected(key)}
                    className={
                      "flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl border p-1 text-center transition-all sm:min-h-[72px] " +
                      (key
                        ? active
                          ? "cursor-pointer border-[#FFB800] bg-gradient-to-b from-[#D90429] to-[#800214] text-white shadow-md"
                          : "cursor-pointer border-[#E5C880] bg-[#FFFDF5] text-[#2C1210] hover:border-[#D97706]/60 hover:bg-[#FFF8EC]"
                        : "cursor-default border-transparent bg-[#FFFDF5]/40 text-[#2C1210]/35")
                    }
                  >
                    <span className="text-xs font-mono font-black sm:text-sm">{n}</span>
                    {marker && (
                      <>
                        <span
                          className={
                            "block max-w-full truncate px-0.5 text-[7px] font-black uppercase leading-tight tracking-tight sm:text-[8.5px] " +
                            (active ? "text-amber-100" : "text-[#D90429]")
                          }
                        >
                          {LABELLED.get(marker.key)}
                        </span>
                        <span
                          className={
                            "block max-w-full truncate px-0.5 font-serif text-[7px] leading-tight sm:text-[8.5px] " +
                            (active ? "text-white/80" : "text-[#2C1210]/55")
                          }
                        >
                          {marker.subtitleBn.split(" · ")[1] ?? marker.bnName}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Selected day panel */}
          <section
            aria-live="polite"
            className="mt-6 rounded-3xl border-2 border-[#E5C880] bg-[#FFFDF5] p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E5C880]/60 pb-3">
              <div>
                <h2 className="font-serif text-2xl font-black text-[#D90429]">
                  {day.bnName}{" "}
                  <span className="text-[#2C1210]/60">({day.enName})</span>
                </h2>
                <p className="mt-0.5 text-sm font-serif font-semibold text-[#D97706]">
                  {day.subtitleBn}
                </p>
              </div>
              <p className="font-mono text-xs font-black uppercase tracking-widest text-[#2C1210]/60">
                {day.longDate}
              </p>
            </div>

            <p className="mt-4 font-serif text-[15px] leading-relaxed text-[#2C1210]/85">
              {day.narrativeBn}
            </p>

            <div className="mt-4 rounded-2xl border border-[#E5C880] bg-white p-4">
              <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#D90429]">
                তিথি সময়
              </p>
              <p className="mt-1 font-serif text-sm text-[#2C1210]/85">
                {day.tithiTiming}
              </p>
            </div>

            <h3 className="mt-5 text-[10px] font-mono font-black uppercase tracking-widest text-[#D90429]">
              {day.ritesHeading}
            </h3>
            <div className="mt-2 space-y-1.5">
              {day.rites.map(([label, time]) => (
                <div
                  key={label + time}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 rounded-xl border border-[#E5C880]/50 bg-white px-3 py-2"
                >
                  <span className="min-w-0 font-serif text-sm font-bold text-[#2C1210]">
                    {label}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-bold text-[#D97706]">
                    {time}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        /* Almanac view */
        <section className="mt-6 space-y-4">
          <p className="font-serif text-sm text-[#2C1210]/70">
            The traditional almanac reading for each day of Devi Paksha, with the
            Bengali month and the tithi end time.
          </p>
          {ALMANAC.map((e) => (
            <article
              key={e.dateEn}
              className="rounded-2xl border border-[#E5C880] bg-[#FFFDF5] p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E5C880]/50 pb-2">
                <h3 className="font-serif text-lg font-black">{e.titleBn}</h3>
                <p className="font-mono text-xs font-black uppercase tracking-wider text-[#D97706]">
                  {e.dateEn} · {e.bengaliMonth}
                </p>
              </div>

              <p className="mt-2 font-serif text-sm font-bold text-[#D90429]">
                {e.tithiName}
              </p>
              <p className="font-serif text-sm text-[#2C1210]/80">{e.tagline}</p>

              <div className="mt-3 rounded-xl border border-[#E5C880] bg-white px-3 py-2">
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#D90429]">
                  {e.timingHeading}
                </p>
                <p className="mt-0.5 font-serif text-sm text-[#2C1210]/85">
                  {e.timing}
                </p>
              </div>

              {e.guidance.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {e.guidance.map((g) => (
                    <li
                      key={g}
                      className="font-serif text-sm leading-relaxed text-[#2C1210]/80"
                    >
                      {g}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "rounded-full px-4 py-1.5 text-xs font-mono font-bold transition-colors " +
        (active
          ? "bg-[#D90429] text-white shadow-sm"
          : "text-[#2C1210]/70 hover:text-[#D90429]")
      }
    >
      {children}
    </button>
  );
}