"use client";

import { useMemo, useState } from "react";
import type {
  Pandal,
  PlannerResult,
  PlannerStop,
  Poi,
  TravelMode,
} from "./types";
import {
  MODE_META,
  estimateAllModes,
  formatDistanceM,
  formatKm,
  formatSeconds,
  haversineM,
  straightLineStopMeters,
  titleCase,
} from "./utils";
import { Icon, MODE_ICONS, ModeTabs, Spinner } from "./ui";

type Field = "start" | "add" | "end";

type Suggestion = {
  key: string;
  name: string;
  locality: string;
  zone?: string;
  metro?: string;
  lat: number;
  lng: number;
  kind: "pandal" | "poi";
  id: string;
};

function localGeoStop(): Promise<PlannerStop | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          id: "gps-current-location",
          name: "Current location",
          locality: `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          kind: "gps",
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

export function PlannerPanel({
  stops,
  onStopsChange,
  mode,
  onModeChange,
  result,
  loading,
  onGenerate,
  onEdit,
  onClear,
  onRecalculate,
  onShare,
  onSave,
  onAddNearby,
  onAddAllNearby,
  onFlyTo,
  saved,
  pandals,
  pois,
  onToast,
}: {
  stops: PlannerStop[];
  onStopsChange: (stops: PlannerStop[]) => void;
  mode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
  result: PlannerResult | null;
  loading: boolean;
  onGenerate: () => void;
  onEdit: () => void;
  onClear: () => void;
  onRecalculate: () => void;
  onShare: () => void;
  onSave: () => void;
  onAddNearby: (pandal: Pandal) => void;
  onAddAllNearby: () => void;
  onFlyTo: (stop: PlannerStop) => void;
  saved: boolean;
  pandals: Pandal[];
  pois: Poi[];
  onToast: (message: string) => void;
}) {
  const [queries, setQueries] = useState<Record<Field, string>>({
    start: "",
    add: "",
    end: "",
  });
  const [field, setField] = useState<Field>("start");
  const [stepsOpen, setStepsOpen] = useState(false);
  const query = queries[field];

  const updateQuery = (which: Field, value: string) => {
    setField(which);
    setQueries((previous) => ({ ...previous, [which]: value }));
  };

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: Suggestion[] = [];
    const seen = new Set<string>();
    for (const p of pandals) {
      const hay = `${p.name} ${p.locality} ${p.metro} ${p.zone}`.toLowerCase();
      if (!hay.includes(q)) continue;
      const key = `${p.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        id: p.slug,
        name: p.name,
        locality: p.locality || p.address,
        zone: p.zone,
        metro: p.metro,
        lat: p.lat,
        lng: p.lng,
        kind: "pandal",
      });
      if (out.length >= 7) break;
    }
    for (const poi of pois) {
      if (out.length >= 9) break;
      if (!`${poi.name} ${poi.address}`.toLowerCase().includes(q)) continue;
      out.push({
        key: poi.id,
        id: poi.id,
        name: poi.name,
        locality: poi.address || poi.category.replace(/-/g, " "),
        lat: poi.lat,
        lng: poi.lng,
        kind: "poi",
      });
    }
    return out.slice(0, 8);
  }, [pandals, pois, query]);

  const pick = (suggestion: Suggestion) => {
    const stop: PlannerStop = {
      id: suggestion.id,
      name: suggestion.name,
      locality: suggestion.locality,
      zone: suggestion.zone,
      metro: suggestion.metro,
      lat: suggestion.lat,
      lng: suggestion.lng,
      kind: suggestion.kind,
    };
    if (field === "start") {
      const next = [...stops];
      if (next.length === 0) next.push(stop);
      else next[0] = stop;
      onStopsChange(next);
    } else if (field === "end") {
      const next = [...stops];
      if (next.length === 0) next.push(stop);
      else if (next.length === 1) next.push(stop);
      else next[next.length - 1] = stop;
      onStopsChange(next);
    } else {
      const next = [...stops];
      if (next.length < 2) next.push(stop);
      else next.splice(next.length - 1, 0, stop);
      onStopsChange(next);
    }
    setQueries((previous) => ({ ...previous, [field]: "" }));
  };

  const removeStop = (index: number) => {
    onStopsChange(stops.filter((_, i) => i !== index));
  };

  const swap = () => {
    if (stops.length < 2) return;
    const next = [...stops];
    const first = next[0];
    next[0] = next[next.length - 1];
    next[next.length - 1] = first;
    onStopsChange(next);
  };

  const useGps = async (which: "start" | "end") => {
    const stop = await localGeoStop();
    if (!stop) {
      onToast("Location is unavailable — allow location access or search for a place.");
      return;
    }
    if (which === "start") {
      const next = [...stops];
      if (next.length === 0) next.push(stop);
      else next[0] = stop;
      onStopsChange(next);
    } else {
      const next = [...stops];
      if (next.length === 0) next.push(stop);
      else if (next.length === 1) next.push(stop);
      else next[next.length - 1] = stop;
      onStopsChange(next);
    }
  };

  const estimated = stops.length >= 2 ? estimateAllModes(straightLineStopMeters(stops)) : null;
  const modeSeconds = result?.modeSeconds || estimated;
  const activeSeconds = result?.modeSeconds[mode] || (estimated ? estimated[mode] : null);

  if (result) {
    const km = result.distanceM / 1000;
    return (
      <div className="flex h-full flex-col">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate font-serif text-xs font-black text-[#2C1210]">
            {titleCase(result.stops[0]?.name || "")} →{" "}
            {titleCase(result.stops[result.stops.length - 1]?.name || "")}
          </h2>
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 cursor-pointer rounded-lg border border-[#E5C880] px-2 py-1 font-mono text-[9px] font-bold text-[#B45309] hover:border-[#D90429] hover:text-[#D90429]"
          >
            Edit
          </button>
        </div>

        <ModeTabs
          active={mode}
          seconds={modeSeconds}
          onChange={onModeChange}
          compact
        />

        {loading && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#E5C880] bg-white p-2 font-mono text-[9px] text-[#B45309]">
            <Spinner size={12} /> Calculating the {MODE_META[mode].label.toLowerCase()} route...
          </div>
        )}

        <div className="mt-2 rounded-xl border border-[#E5C880] bg-white p-2.5">
          <div className="flex flex-wrap items-baseline gap-1">
            <span className="font-serif text-lg font-black text-[#2C1210]">
              {formatKm(km)}
            </span>
            <span className="font-serif text-sm font-bold text-[#D90429]">
              • ~{formatSeconds(activeSeconds)}
            </span>
            <span className="font-mono text-[9px] font-bold uppercase text-[#2C1210]/45">
              ({MODE_META[mode].label})
            </span>
            {result.fallback ? (
              <span className="rounded bg-[#FFF3D6] px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#B45309]">
                direct estimate
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setStepsOpen((value) => !value)}
            className="mt-1 flex cursor-pointer items-center gap-1 font-mono text-[8.5px] font-bold uppercase text-[#B45309] hover:text-[#D90429]"
          >
            <Icon name="route" size={10} />
            {result.turnSteps} turn steps
            <Icon
              name="chevronRight"
              size={9}
              className={`transition-transform ${stepsOpen ? "rotate-90" : ""}`}
            />
          </button>
          {stepsOpen && (
            <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto rounded-lg bg-[#FFFBF0] p-1.5">
              {result.steps.length ? (
                result.steps.map((step, index) => (
                  <div key={`${step.instruction}-${index}`} className="flex gap-1.5">
                    <span className="w-3 shrink-0 text-right font-mono text-[8px] font-bold text-[#D90429]">
                      {index + 1}
                    </span>
                    <p className="font-sans text-[9px] leading-snug text-[#2C1210]/70">
                      {step.instruction}{" "}
                      <span className="font-mono text-[8px] text-[#2C1210]/40">
                        {formatDistanceM(step.distanceM)}
                      </span>
                    </p>
                  </div>
                ))
              ) : (
                <p className="font-sans text-[9px] text-[#2C1210]/50">
                  Follow the plotted line on the map. Use the Google Maps link for spoken directions.
                </p>
              )}
            </div>
          )}

          <div className="mt-2 flex items-start gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <div className="min-w-0 flex-1">
              <p className="font-sans text-[10.5px] font-bold leading-tight text-[#2C1210]">
                {titleCase(result.stops[0]?.name || "")}
              </p>
              <p className="truncate font-sans text-[8.5px] text-[#2C1210]/45">
                {result.stops[0]?.locality}
              </p>
            </div>
          </div>
          <div className="ml-[3.5px] flex gap-2 border-l border-dashed border-[#D90429]/40 py-1 pl-3">
            <span className="font-mono text-[8.5px] font-bold uppercase text-[#D90429]">
              {MODE_META[mode].label} to destination
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#D90429]" />
            <div className="min-w-0 flex-1">
              <p className="font-sans text-[10.5px] font-bold leading-tight text-[#2C1210]">
                {titleCase(result.stops[result.stops.length - 1]?.name || "")}
              </p>
              <p className="truncate font-sans text-[8.5px] text-[#2C1210]/45">
                {result.stops[result.stops.length - 1]?.locality}
              </p>
            </div>
          </div>
        </div>

        {result.nearby.length > 0 && (
          <div className="mt-2 rounded-xl border border-[#E5C880]/70 bg-[#FFFBF0] p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-serif text-[10.5px] font-black text-[#2C1210]">
                Pandals on the Way{" "}
                <span className="font-mono text-[8px] font-bold text-[#B45309]">
                  ({result.nearby.length} ·{" "}
                  {result.nearby.filter((n) => n.pandal.featured).length} Featured)
                </span>
              </p>
              <button
                type="button"
                onClick={onAddAllNearby}
                className="shrink-0 cursor-pointer rounded-md border border-[#D90429] bg-[#D90429]/5 px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#D90429]"
              >
                Add All ({result.nearby.length})
              </button>
            </div>
            <p className="font-sans text-[8.5px] italic text-[#2C1210]/40">
              Along your route (&lt;100m, &lt;250m for featured)
            </p>
            <div className="mt-1 max-h-32 space-y-1 overflow-y-auto pr-1">
              {result.nearby.map(({ pandal, distanceM }) => (
                <div
                  key={pandal.slug}
                  className="flex items-center gap-1.5 rounded-lg border border-[#E5C880]/50 bg-white px-1.5 py-1"
                >
                  <span className="shrink-0 font-mono text-[8px] font-bold text-[#B45309]">
                    {formatDistanceM(distanceM)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-[9.5px] font-semibold text-[#2C1210]">
                      {titleCase(pandal.name)}
                    </p>
                    <p className="truncate font-sans text-[8px] text-[#2C1210]/45">
                      {pandal.locality}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddNearby(pandal)}
                    className="shrink-0 cursor-pointer rounded bg-[#D90429] px-1.5 py-0.5 font-mono text-[8px] font-bold text-white"
                    aria-label={`Add ${pandal.name}`}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-2 space-y-1">
          <a
            href={result.googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E5C880] bg-[#FFF3D6] px-2 py-1.5 font-serif text-[10px] font-bold text-[#B45309] transition-colors hover:border-[#D90429] hover:text-[#D90429]"
          >
            <Icon name="google" size={12} /> Open Turn-by-Turn in Google Maps
            <Icon name="arrowUpRight" size={10} />
          </a>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onSave}
              className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 py-1.5 font-serif text-[10px] font-bold transition-colors ${
                saved
                  ? "border-[#D90429] bg-[#D90429]/8 text-[#D90429]"
                  : "border-[#E5C880] bg-white text-[#2C1210] hover:border-[#D90429]"
              }`}
            >
              <Icon name="bookmark" size={11} filled={saved} />
              {saved ? "Saved" : "Save Route"}
            </button>
            <button
              type="button"
              onClick={onShare}
              className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 font-serif text-[10px] font-bold text-[#2C1210] transition-colors hover:border-[#D90429]"
            >
              <Icon name="share" size={11} /> Share Trail
            </button>
            <button
              type="button"
              onClick={onRecalculate}
              className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 font-serif text-[10px] font-bold text-[#2C1210] transition-colors hover:border-[#D90429]"
            >
              <Icon name="route" size={11} /> Recalculate
            </button>
            <button
              type="button"
              onClick={onClear}
              className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#D90429]/40 bg-[#D90429]/5 px-2 py-1.5 font-serif text-[10px] font-bold text-[#D90429] transition-colors hover:bg-[#D90429]/10"
            >
              <Icon name="close" size={11} /> Clear
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ModeTabs
        active={mode}
        seconds={modeSeconds}
        onChange={onModeChange}
        compact
      />

      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[9px] font-black uppercase tracking-wider text-[#2C1210]/45">
          Puja Route Stops
        </span>
        <span className="rounded bg-[#FFF3D6] px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-[#B45309]">
          {stops.length} {stops.length === 1 ? "Stop" : "Stops"}
        </span>
      </div>

      <div className="mt-1.5 space-y-1">
        {stops.length > 0 && (
          <div className="rounded-xl border border-[#E5C880] bg-white p-2">
            {stops.map((stop, index) => {
              const isStart = index === 0;
              const isEnd = index === stops.length - 1 && stops.length > 1;
              return (
                <div
                  key={`${stop.id}-${index}`}
                  className={`flex items-center gap-1.5 ${
                    index > 0 ? "mt-1 border-t border-dashed border-[#E5C880]/60 pt-1" : ""
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[7px] font-bold text-white ${
                      isStart ? "bg-emerald-500" : isEnd ? "bg-[#D90429]" : "bg-[#B45309]"
                    }`}
                  >
                    {isStart ? "S" : isEnd ? "E" : index}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-[9.5px] font-bold leading-tight text-[#2C1210]">
                      {titleCase(stop.name)}
                    </p>
                    <p className="truncate font-sans text-[8px] text-[#2C1210]/45">
                      {stop.locality}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFlyTo(stop)}
                    className="cursor-pointer p-0.5 text-[#2C1210]/35 hover:text-[#D90429]"
                    aria-label="Show stop on map"
                  >
                    <Icon name="mapPin" size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStop(index)}
                    className="cursor-pointer p-0.5 text-[#2C1210]/35 hover:text-[#D90429]"
                    aria-label="Remove stop"
                  >
                    <Icon name="close" size={10} />
                  </button>
                </div>
              );
            })}
            {stops.length > 1 && (
              <button
                type="button"
                onClick={swap}
                className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1 rounded-md border border-[#E5C880] bg-[#FFFBF0] py-0.5 font-mono text-[8px] font-bold uppercase text-[#B45309] hover:text-[#D90429]"
              >
                <Icon name="swap" size={9} /> Swap start &amp; end
              </button>
            )}
          </div>
        )}

        <div className="flow-root">
          <div className="mb-0.5 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono text-[8px] font-bold uppercase text-[#2C1210]/45">
              Start
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative min-w-0 flex-1">
              <input
                value={queries.start}
                onChange={(event) => updateQuery("start", event.target.value)}
                onFocus={() => setField("start")}
                placeholder="Start point (e.g. Tridhara)..."
                className="w-full rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 font-sans text-[10px] text-[#2C1210] outline-none placeholder:text-[#2C1210]/35 focus:border-[#D90429]"
              />
            </div>
            <button
              type="button"
              onClick={() => useGps("start")}
              className="cursor-pointer rounded-lg border border-[#E5C880] bg-white p-1.5 text-[#D90429] hover:border-[#D90429]"
              aria-label="Use current location as start"
              title="Use my location"
            >
              <Icon name="gps" size={11} />
            </button>
          </div>

          <div className="mb-0.5 mt-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B45309]" />
            <span className="font-mono text-[8px] font-bold uppercase text-[#2C1210]/45">
              Add a stop
            </span>
          </div>
          <input
            value={queries.add}
            onChange={(event) => updateQuery("add", event.target.value)}
            onFocus={() => setField("add")}
            placeholder="Add a stop…"
            className="w-full rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 font-sans text-[10px] text-[#2C1210] outline-none placeholder:text-[#2C1210]/35 focus:border-[#D90429]"
          />

          <div className="mb-0.5 mt-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D90429]" />
            <span className="font-mono text-[8px] font-bold uppercase text-[#2C1210]/45">
              Destination
            </span>
          </div>
          <div className="flex items-center gap-1">
            <input
              value={queries.end}
              onChange={(event) => updateQuery("end", event.target.value)}
              onFocus={() => setField("end")}
              placeholder="Destination (e.g. Suruchi)..."
              className="w-full rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 font-sans text-[10px] text-[#2C1210] outline-none placeholder:text-[#2C1210]/35 focus:border-[#D90429]"
            />
            <button
              type="button"
              onClick={() => useGps("end")}
              className="cursor-pointer rounded-lg border border-[#E5C880] bg-white p-1.5 text-[#D90429] hover:border-[#D90429]"
              aria-label="Use current location as destination"
              title="Use my location"
            >
              <Icon name="gps" size={11} />
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-1.5 rounded-xl border border-[#E5C880] bg-white p-1 shadow-sm">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.key}
                  type="button"
                  onClick={() => pick(suggestion)}
                  className="flex w-full cursor-pointer items-start gap-1.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-[#FFF3D6]"
                >
                  <Icon
                    name={suggestion.kind === "poi" ? "transit" : "mapPin"}
                    size={11}
                    className="mt-0.5 shrink-0 text-[#B45309]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-sans text-[9.5px] font-bold text-[#2C1210]">
                      {titleCase(suggestion.name)}
                    </span>
                    <span className="block truncate font-sans text-[8px] text-[#2C1210]/45">
                      {suggestion.locality}
                      {suggestion.zone ? ` (${suggestion.zone.toUpperCase()})` : ""}
                      {suggestion.metro ? ` · ${suggestion.metro}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto pt-2">
        <button
          type="button"
          disabled={stops.length < 2 || loading}
          onClick={onGenerate}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#D90429] px-3 py-2 font-serif text-[11px] font-black text-white shadow-sm transition-all hover:bg-[#B50321] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Spinner size={13} /> : <Icon name="route" size={13} />}
          {loading ? "Generating route..." : "Generate Puja Route"}
        </button>
        {stops.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="mt-1 w-full cursor-pointer rounded-lg border border-[#E5C880] bg-white py-1 font-mono text-[9px] font-bold uppercase text-[#B45309] transition-colors hover:border-[#D90429] hover:text-[#D90429]"
          >
            Clear Stops
          </button>
        )}
        {stops.length < 2 && (
          <p className="mt-1.5 rounded-lg border border-dashed border-[#E5C880] bg-[#FFFBF0] px-2 py-2 text-center font-sans text-[9px] leading-snug text-[#2C1210]/50">
            Tap any pandal on the map or search above to create your route.
          </p>
        )}
      </div>
    </div>
  );
}
