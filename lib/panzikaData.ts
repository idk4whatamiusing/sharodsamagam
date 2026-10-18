/**
 * The Panzika dataset, as harvested from the original site.
 *
 * PROVENANCE: every field here is the original's own wording, read through a
 * browser by scripts/harvest-panzika.mjs. The original renders these panels
 * client-side, so the mirrored HTML in mirror/panzika.html only ever captured
 * one of them - and a stale one. Nothing in this file is paraphrase.
 *
 * Re-run `node scripts/harvest-panzika.mjs` to refresh it if the original
 * changes; do not hand-edit, or the page stops matching the source.
 */

import raw from "../data/panzika.json";

/** Stable slugs. These match the `data-fday` keys used on the home page. */
export type PanzikaKey =
  | "mahalaya"
  | "shashthi"
  | "saptami1"
  | "saptami2"
  | "ashtami"
  | "nabami"
  | "dashami";

export type PanzikaDay = {
  key: PanzikaKey;
  /** Day of October 2026. */
  day: number;
  /** Bengali tithi name, e.g. "সপ্তমী". */
  bnName: string;
  /** English tithi name, e.g. "Saptami". */
  enName: string;
  /** e.g. "18th October, Sunday". */
  longDate: string;
  /** e.g. "মহাসপ্তমী ২ · শুক্লা সপ্তমীবিহিত অধিক পূজা". */
  subtitleBn: string;
  /** The original's Bengali prose for the day. */
  narrativeBn: string;
  /** Tithi start/end note, Bengali numerals preserved. */
  tithiTiming: string;
  /** Heading over the ritual table, e.g. "পূজার নির্ঘণ্ট ও প্রশস্ত সময়". */
  ritesHeading: string;
  /** [ritual, timing] pairs, as printed. */
  rites: readonly (readonly [string, string])[];
};

export type AlmanacEntry = {
  titleBn: string;
  /** e.g. "19 Oct 2026 (Mon)". */
  dateEn: string;
  /** Traditional Bengali month and date, e.g. "১ কার্তিক". */
  bengaliMonth: string;
  tithiName: string;
  tagline: string;
  timingHeading: string;
  timing: string;
  guidance: readonly string[];
};

type RawRite = [string, string];

// The JSON types tuples as string[][], which TypeScript will not narrow on its
// own. Mapping through a normaliser both satisfies the checker and asserts
// the shape at runtime, so a malformed harvest fails here rather than
// rendering empty rows on the page.
const asRites = (rows: readonly string[][]): readonly RawRite[] =>
  rows.map((r) => {
    if (r.length < 2) throw new Error("panzika rite row is missing a timing");
    return [String(r[0]), String(r[1])];
  });

type RawDay = Omit<PanzikaDay, "key" | "rites"> & {
  key: string;
  rites: readonly string[][];
};

export const PANZIKA_DAYS: readonly PanzikaDay[] = (raw.days as readonly RawDay[]).map(
  (d) => ({
    ...d,
    key: d.key as PanzikaKey,
    rites: asRites(d.rites),
  })
);

export const ALMANAC: readonly AlmanacEntry[] = raw.almanac as readonly AlmanacEntry[];

export const PANZIKA_BY_KEY = Object.fromEntries(
  PANZIKA_DAYS.map((d) => [d.key, d])
) as Record<PanzikaKey, PanzikaDay>;

/**
 * Days that carry a marker in the October 2026 grid, keyed by day-of-month.
 * The grid renders every date in the month; this decides which ones are
 * clickable and what they select.
 */
export const PANZIKA_BY_DAY: Readonly<Record<number, PanzikaKey>> = Object.fromEntries(
  PANZIKA_DAYS.map((d) => [d.day, d.key])
) as Record<number, PanzikaKey>;