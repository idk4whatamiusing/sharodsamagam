"use client";

import { useState } from "react";
import type { CuratedRoute, RouteCopy, RouteGeo, TravelMode } from "./types";
import {
  MODE_META,
  defaultModeSecondsForGeo,
  formatKm,
  formatSeconds,
  pandalStops,
  titleCase,
} from "./utils";
import { Icon, ModeTabs, Spinner } from "./ui";

function routeCode(route: CuratedRoute) {
  return `DPKR${String(route.number).padStart(2, "0")}`;
}

export function TrailsPanel({
  routes,
  copy,
  activeRoute,
  activeGeo,
  geoLoading,
  onPlot,
  onEdit,
  onClear,
  onShare,
  onSave,
  saved,
}: {
  routes: CuratedRoute[];
  copy: Record<string, RouteCopy>;
  activeRoute: CuratedRoute | null;
  activeGeo: RouteGeo | null;
  geoLoading: boolean;
  onPlot: (route: CuratedRoute) => void;
  onEdit: () => void;
  onClear: () => void;
  onShare: (route: CuratedRoute) => void;
  onSave: (route: CuratedRoute) => void;
  saved: boolean;
}) {
  if (activeRoute) {
    return (
      <ActiveTrail
        route={activeRoute}
        geo={activeGeo}
        loading={geoLoading}
        onEdit={onEdit}
        onClear={onClear}
        onShare={onShare}
        onSave={onSave}
        onPlot={onPlot}
        saved={saved}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-sm font-black leading-tight text-[#2C1210]">
            Curated Team Circuits
          </h2>
          <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#2C1210]/45">
            {routes.length} Predefined Routes with Direct Waypoints
          </p>
        </div>
        <a
          href="/routes"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E5C880] bg-[#FFF3D6] px-2 py-1 font-mono text-[8.5px] font-bold text-[#B45309] transition-colors hover:border-[#D90429] hover:text-[#D90429]"
        >
          Full Guide <Icon name="arrowUpRight" size={10} />
        </a>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {routes.map((route) => {
          const c = copy[String(route.number)];
          return (
            <TrailCard
              key={route.id}
              route={route}
              copy={c}
              onPlot={() => onPlot(route)}
            />
          );
        })}
      </div>
    </div>
  );
}

function TrailCard({
  route,
  copy,
  onPlot,
}: {
  route: CuratedRoute;
  copy?: RouteCopy;
  onPlot: () => void;
}) {
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const sections = copy?.sections || [];
  return (
    <div className="group rounded-2xl border border-[#E5C880]/70 bg-white p-3 shadow-2xs transition-all hover:border-[#D90429]">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-[#D90429]/10 px-2 py-0.5 font-mono text-[9.5px] font-black uppercase text-[#D90429]">
          Route {routeCode(route)}
        </span>
        <span className="rounded-md bg-[#FFF3D6] px-2 py-0.5 font-mono text-[9.5px] font-bold text-[#B45309]">
          {copy?.zone || titleCase(route.zone)} · {copy?.stops || route.stopsCount} stops
        </span>
      </div>
      <h4 className="font-serif text-xs font-bold leading-snug text-[#2C1210] group-hover:text-[#D90429]">
        {copy?.title || titleCase(route.title)}
      </h4>
      {(copy?.metro || route.metroHub) && (
        <p className="mt-0.5 truncate font-mono text-[9px] font-semibold text-[#B45309]">
          {copy?.metro || route.metroHub}
        </p>
      )}
      <p className="mt-1 line-clamp-2 font-sans text-[10px] leading-snug text-[#2C1210]/60">
        {copy?.description || route.bestUse}
      </p>

      <div className="mt-1.5 space-y-0.5 rounded-lg bg-[#FFFBF0] p-1.5">
        <div className="flex gap-1.5">
          <span className="shrink-0 font-mono text-[8.5px] font-bold uppercase text-[#2C1210]/45">
            Start:
          </span>
          <span className="font-sans text-[9.5px] font-semibold leading-tight text-[#2C1210]">
            {copy?.start || titleCase(route.start?.name || "")}
          </span>
        </div>
        <div className="flex gap-1.5">
          <span className="shrink-0 font-mono text-[8.5px] font-bold uppercase text-[#2C1210]/45">
            Finish:
          </span>
          <span className="font-sans text-[9.5px] leading-tight text-[#2C1210]/75">
            {copy?.finish || titleCase(route.finishLocation || "")}
          </span>
        </div>
      </div>

      {(copy?.earlyExits || route.earlyExits) && (
        <p className="mt-1 font-sans text-[9px] leading-snug text-[#2C1210]/50">
          <span className="font-mono font-bold uppercase text-[#B45309]">Early exits:</span>{" "}
          {copy?.earlyExits || route.earlyExits}
        </p>
      )}

      {sections.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setSectionsOpen((value) => !value)}
            className="mt-1.5 flex cursor-pointer items-center gap-1 font-mono text-[8.5px] font-bold uppercase tracking-wide text-[#B45309] hover:text-[#D90429]"
          >
            <Icon
              name="chevronRight"
              size={9}
              className={`transition-transform ${sectionsOpen ? "rotate-90" : ""}`}
            />
            {sectionsOpen ? "Hide" : "View"} trail sections ({copy?.sectionCount || sections.length})
          </button>
          {sectionsOpen && (
            <div className="mt-1.5 space-y-1 rounded-lg border border-[#E5C880]/50 bg-[#FFFBF0] p-1.5">
              {sections.map((section) => (
                <div key={section.title}>
                  <p className="font-mono text-[8.5px] font-bold uppercase tracking-wide text-[#D90429]">
                    {section.title}
                  </p>
                  <p className="font-sans text-[9.5px] leading-snug text-[#2C1210]/70">
                    {section.stops.map((stop) => titleCase(stop)).join(" → ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-2 flex items-center gap-1.5 border-t border-[#DECFA6]/40 pt-2">
        <a
          href={`/routes#route-${String(route.number).padStart(2, "0")}`}
          className="flex-1 rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 text-center font-serif text-[10.5px] font-bold text-[#2C1210] transition-colors hover:bg-[#FFF3D6] hover:text-[#D90429]"
        >
          View in Routes Guide
        </a>
        <button
          type="button"
          onClick={onPlot}
          className="flex-1 cursor-pointer rounded-lg bg-[#D90429] px-2 py-1.5 font-serif text-[10.5px] font-bold text-white transition-colors hover:bg-[#B50321]"
        >
          Plot on Map
        </button>
      </div>
    </div>
  );
}

function ActiveTrail({
  route,
  geo,
  loading,
  onEdit,
  onClear,
  onShare,
  onSave,
  onPlot,
  saved,
}: {
  route: CuratedRoute;
  geo: RouteGeo | null;
  loading: boolean;
  onEdit: () => void;
  onClear: () => void;
  onShare: (route: CuratedRoute) => void;
  onSave: (route: CuratedRoute) => void;
  onPlot: (route: CuratedRoute) => void;
  saved: boolean;
}) {
  const [mode, setMode] = useState<TravelMode | null>(null);
  const seconds = geo ? defaultModeSecondsForGeo(geo) : null;
  const initialMode: TravelMode =
    geo?.summaryMode === "Drive"
      ? "drive"
      : geo?.summaryMode === "Cycle"
        ? "cycle"
        : geo?.summaryMode === "Transit"
          ? "transit"
          : "walk";
  const activeMode = mode || initialMode;
  const activeSeconds = seconds?.[activeMode] || geo?.durationS || null;
  const km = geo?.km ?? (geo?.distanceM ? geo.distanceM / 1000 : null);
  const stops = pandalStops(route);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-[#D90429] px-2 py-0.5 font-mono text-[9.5px] font-black uppercase text-white">
            Route {routeCode(route)}
          </span>
          <span className="rounded-md bg-[#FFF3D6] px-2 py-0.5 font-mono text-[9px] font-bold text-[#B45309]">
            {stops.length} stops
          </span>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="cursor-pointer rounded-lg border border-[#E5C880] px-2 py-1 font-mono text-[9px] font-bold text-[#B45309] hover:border-[#D90429] hover:text-[#D90429]"
        >
          Edit
        </button>
      </div>

      {seconds && (
        <ModeTabs
          active={activeMode}
          seconds={seconds}
          onChange={(next) => setMode(next)}
          compact
        />
      )}

      <div className="mt-2">
        <h3 className="font-serif text-xs font-black leading-snug text-[#2C1210]">
          {titleCase(route.start?.name || "")} → {titleCase(route.end?.name || "")}
        </h3>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-[#E5C880] bg-white p-2 font-mono text-[9px] text-[#B45309]">
          <Spinner size={12} /> Loading trail geometry...
        </div>
      )}

      {geo && (
        <div className="mt-1.5 rounded-xl border border-[#E5C880] bg-white p-2.5">
          <div className="flex flex-wrap items-baseline gap-1">
            <span className="font-serif text-lg font-black text-[#2C1210]">
              {formatKm(km)}
            </span>
            <span className="font-serif text-sm font-bold text-[#D90429]">
              • ~{formatSeconds(activeSeconds)}
            </span>
            <span className="font-mono text-[9px] font-bold uppercase text-[#2C1210]/45">
              ({MODE_META[activeMode].label})
            </span>
            {activeMode === "transit" && geo.savesSeconds ? (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-emerald-700">
                Saves ~{formatSeconds(geo.savesSeconds)}
              </span>
            ) : geo.turnSteps ? (
              <span className="rounded bg-[#FFF3D6] px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-[#B45309]">
                {geo.turnSteps} turn steps
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex items-start gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <div className="min-w-0">
              <p className="font-sans text-[10.5px] font-bold leading-tight text-[#2C1210]">
                {titleCase(route.start?.name || "")}
              </p>
              <p className="truncate font-sans text-[8.5px] text-[#2C1210]/45">
                {route.start?.locality}
              </p>
            </div>
          </div>
          <div className="ml-[3.5px] flex gap-2 border-l border-dashed border-[#D90429]/40 py-1 pl-3">
            <span className="font-mono text-[8.5px] font-bold uppercase text-[#D90429]">
              {MODE_META[activeMode].label} to destination
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#D90429]" />
            <div className="min-w-0">
              <p className="font-sans text-[10.5px] font-bold leading-tight text-[#2C1210]">
                {titleCase(route.end?.name || "")}
              </p>
              <p className="truncate font-sans text-[8.5px] text-[#2C1210]/45">
                {route.end?.locality}
              </p>
            </div>
          </div>
        </div>
      )}

      {stops.length > 0 && (
        <div className="mt-1.5 rounded-xl border border-[#E5C880]/70 bg-[#FFFBF0] p-2">
          <p className="font-mono text-[8.5px] font-black uppercase tracking-wider text-[#2C1210]/45">
            Via {stops.length} stops
          </p>
          <div className="mt-1 max-h-28 space-y-0.5 overflow-y-auto pr-1">
            {stops.map((stop, index) => (
              <div key={`${stop.name}-${index}`} className="flex gap-1.5">
                <span className="w-3 shrink-0 text-right font-mono text-[8px] font-bold text-[#B45309]">
                  {index + 1}
                </span>
                <span className="font-sans text-[9px] leading-snug text-[#2C1210]/70">
                  {titleCase(stop.name)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {geo?.legs && geo.legs.length > 0 && (
        <div className="mt-1.5">
          <p className="mb-1 font-mono text-[8.5px] font-black uppercase tracking-wider text-[#2C1210]/45">
            Google Maps legs
          </p>
          <div className="space-y-1">
            {geo.legs.map((leg, index) => (
              <a
                key={`${leg.href}-${index}`}
                href={leg.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-[#E5C880]/70 bg-white px-2 py-1 font-sans text-[9.5px] font-semibold text-[#2C1210] transition-colors hover:border-[#D90429] hover:text-[#D90429]"
              >
                <Icon name="google" size={11} className="shrink-0 text-[#B45309]" />
                <span className="truncate">{leg.label || `Leg ${index + 1}`}</span>
                <Icon name="external" size={9} className="ml-auto shrink-0 opacity-50" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-2">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onSave(route)}
            className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 py-1.5 font-serif text-[10px] font-bold transition-colors ${
              saved
                ? "border-[#D90429] bg-[#D90429]/8 text-[#D90429]"
                : "border-[#E5C880] bg-white text-[#2C1210] hover:border-[#D90429]"
            }`}
          >
            <Icon name="bookmark" size={11} filled={saved} />
            {saved ? "Saved" : "Save Trail"}
          </button>
          <button
            type="button"
            onClick={() => onShare(route)}
            className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 font-serif text-[10px] font-bold text-[#2C1210] transition-colors hover:border-[#D90429]"
          >
            <Icon name="share" size={11} /> Share Trail
          </button>
          <button
            type="button"
            onClick={() => onPlot(route)}
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
