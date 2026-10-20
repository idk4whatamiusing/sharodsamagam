"use client";

import type { MapFilters } from "./types";
import {
  CATEGORY_OPTIONS,
  TRANSIT_OPTIONS,
  ZONES,
  titleCase,
} from "./utils";
import { Icon } from "./ui";

export function FilterPanel({
  filters,
  onChange,
  onReset,
  filteredCount,
  totalCount,
  zoneCounts,
  categoryCounts,
  heritageCount,
  crowdCounts,
  savedCount,
  transitCount,
  compactHeader = false,
}: {
  filters: MapFilters;
  onChange: (patch: Partial<MapFilters>) => void;
  onReset: () => void;
  filteredCount: number;
  totalCount: number;
  zoneCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  heritageCount: number;
  crowdCounts: Record<string, number>;
  savedCount: number;
  transitCount: number;
  compactHeader?: boolean;
}) {
  const active =
    filters.zone !== "all" ||
    filters.category !== "all" ||
    filters.transit !== "all" ||
    filters.heritage ||
    filters.crowd !== "all" ||
    filters.savedOnly ||
    filters.query.trim().length > 0;

  return (
    <div className="flex h-full flex-col">
      {!compactHeader && (
        <div className="flex items-center justify-between gap-2 pb-2">
          <div>
            <h2 className="font-serif text-sm font-black leading-tight text-[#2C1210]">
              Filter &amp; Search Map
            </h2>
            {active && (
              <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#2C1210]/45">
                Showing {filteredCount} of {totalCount}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-md border border-[#E5C880] bg-[#FFF3D6] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#B45309]">
              {totalCount} PANDALS
            </span>
            {active && (
              <button
                type="button"
                onClick={onReset}
                className="cursor-pointer rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#D90429] underline decoration-dotted underline-offset-2"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mb-2.5">
        <label className="mb-1 block font-mono text-[8.5px] font-black uppercase tracking-wider text-[#2C1210]/45">
          Search location / pandal
        </label>
        <div className="relative">
          <Icon
            name="search"
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#2C1210]/40"
          />
          <input
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="Name, locality or metro..."
            className="w-full rounded-lg border border-[#E5C880] bg-white py-1.5 pl-7 pr-7 font-sans text-[11px] text-[#2C1210] outline-none placeholder:text-[#2C1210]/35 focus:border-[#D90429]"
          />
          {filters.query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onChange({ query: "" })}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer p-0.5 text-[#2C1210]/45 hover:text-[#D90429]"
            >
              <Icon name="close" size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="mb-2.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[8.5px] font-black uppercase tracking-wider text-[#2C1210]/45">
            Filter by zone
          </span>
          {filters.zone !== "all" && (
            <button
              type="button"
              onClick={() => onChange({ zone: "all" })}
              className="cursor-pointer font-mono text-[8px] font-bold text-[#D90429]"
            >
              clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {ZONES.map((zone) => {
            const selected = filters.zone === zone.id;
            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => onChange({ zone: selected ? "all" : zone.id })}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-2 py-1 text-left transition-all ${
                  selected
                    ? "border-[#2C1210] bg-[#2C1210] text-[#FFFBF0]"
                    : "border-[#E5C880]/75 bg-white text-[#2C1210] hover:border-[#D90429]"
                }`}
              >
                <span className="truncate font-sans text-[10px] font-semibold">
                  {zone.label}
                </span>
                <span
                  className={`ml-1 shrink-0 rounded px-1 py-0.5 font-mono text-[8.5px] font-bold ${
                    selected ? "bg-[#FFFBF0]/15 text-[#FFB800]" : "bg-[#FFF3D6] text-[#B45309]"
                  }`}
                >
                  {zoneCounts[zone.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onChange({ savedOnly: !filters.savedOnly })}
          className={`mt-1 flex w-full cursor-pointer items-center justify-between rounded-lg border px-2 py-1 transition-all ${
            filters.savedOnly
              ? "border-[#D90429] bg-[#D90429]/8 text-[#D90429]"
              : "border-[#E5C880]/75 bg-white text-[#2C1210] hover:border-[#D90429]"
          }`}
        >
          <span className="flex items-center gap-1.5 font-sans text-[10px] font-semibold">
            <Icon name="bookmark" size={11} filled={filters.savedOnly} />
            Saved pandals
          </span>
          <span className="rounded bg-[#FFF3D6] px-1 py-0.5 font-mono text-[8.5px] font-bold text-[#B45309]">
            {savedCount}
          </span>
        </button>
      </div>

      <div className="mb-2.5">
        <label className="mb-1 block font-mono text-[8.5px] font-black uppercase tracking-wider text-[#2C1210]/45">
          Theme / category
        </label>
        <div className="relative">
          <select
            value={filters.category}
            onChange={(event) => onChange({ category: event.target.value })}
            className="w-full cursor-pointer appearance-none rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 pr-7 font-sans text-[10.5px] font-medium text-[#2C1210] outline-none focus:border-[#D90429]"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
                {option.id !== "all" ? ` (${categoryCounts[option.id] ?? 0})` : ""}
              </option>
            ))}
          </select>
          <Icon
            name="chevronDown"
            size={11}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#2C1210]/45"
          />
        </div>
      </div>

      <div className="mb-2.5">
        <div className="mb-1 flex items-center justify-between">
          <label className="font-mono text-[8.5px] font-black uppercase tracking-wider text-[#2C1210]/45">
            Transit hubs
          </label>
          <span className="font-mono text-[8px] font-bold text-[#B45309]">
            {transitCount} STATIONS
          </span>
        </div>
        <div className="relative">
          <select
            value={filters.transit}
            onChange={(event) => onChange({ transit: event.target.value })}
            className="w-full cursor-pointer appearance-none rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 pr-7 font-sans text-[10.5px] font-medium text-[#2C1210] outline-none focus:border-[#D90429]"
          >
            {TRANSIT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <Icon
            name="chevronDown"
            size={11}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#2C1210]/45"
          />
        </div>
      </div>

      <div className="mb-2.5">
        <button
          type="button"
          onClick={() => onChange({ heritage: !filters.heritage })}
          className={`flex w-full cursor-pointer items-center justify-between rounded-lg border px-2 py-1.5 text-left transition-all ${
            filters.heritage
              ? "border-[#D90429] bg-[#D90429]/8"
              : "border-[#E5C880]/75 bg-white hover:border-[#D90429]"
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon name="temple" size={14} className={filters.heritage ? "text-[#D90429]" : "text-[#B45309]"} />
            <span>
              <span className="block font-sans text-[10.5px] font-semibold text-[#2C1210]">
                Heritage Pandals
              </span>
              <span className="block font-sans text-[8.5px] text-[#2C1210]/50">
                Established before 1951 (&gt;75 yrs)
              </span>
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-[8.5px] font-bold text-[#B45309]">{heritageCount}</span>
            <span
              className={`relative h-4 w-7 rounded-full transition-colors ${
                filters.heritage ? "bg-[#D90429]" : "bg-[#2C1210]/20"
              }`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${
                  filters.heritage ? "left-3.5" : "left-0.5"
                }`}
              />
            </span>
          </span>
        </button>
      </div>

      <div className="mb-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[8.5px] font-black uppercase tracking-wider text-[#2C1210]/45">
            Crowd status
          </span>
          {filters.crowd !== "all" && (
            <button
              type="button"
              onClick={() => onChange({ crowd: "all" })}
              className="cursor-pointer font-mono text-[8px] font-bold text-[#D90429]"
            >
              clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {["all", "high", "medium", "low"].map((level) => {
            const selected = filters.crowd === level;
            const colors: Record<string, string> = {
              high: "data-[on=true]:border-[#D90429] data-[on=true]:bg-[#D90429]/10 data-[on=true]:text-[#D90429]",
              medium: "data-[on=true]:border-[#D97706] data-[on=true]:bg-[#D97706]/10 data-[on=true]:text-[#B45309]",
              low: "data-[on=true]:border-emerald-600 data-[on=true]:bg-emerald-50 data-[on=true]:text-emerald-700",
              all: "",
            };
            return (
              <button
                key={level}
                type="button"
                data-on={selected}
                onClick={() => onChange({ crowd: selected ? "all" : level })}
                className={`cursor-pointer rounded-lg border px-1 py-1 font-mono text-[8.5px] font-bold capitalize transition-all ${
                  selected
                    ? "border-[#2C1210] bg-[#2C1210] text-[#FFFBF0]"
                    : "border-[#E5C880]/75 bg-white text-[#2C1210]/60 hover:border-[#D90429]"
                } ${colors[level]}`}
              >
                {level === "all" ? "All" : level}
                <span className="ml-0.5 opacity-60">
                  {level === "all"
                    ? ""
                    : crowdCounts[level] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {titleCase(filters.query) && (
        <p className="mt-2 font-sans text-[9px] italic text-[#2C1210]/45">
          Matches across pandal names, localities and nearest metro stations.
        </p>
      )}
    </div>
  );
}
