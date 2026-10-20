"use client";

import { useEffect, useMemo, useState } from "react";
import type { CuratedRoute, RouteCopy } from "../map/types";
import { titleCase, copyToClipboard, pandalStops } from "../map/utils";
import { useSaves } from "../useSaves";
import { Icon, Toast } from "../map/ui";

type StopMeta = { categories: string[]; metro: string; zone: string };

const FILTERS = [
  { id: "all", label: "All Routes" },
  { id: "South", label: "South Kolkata" },
  { id: "North", label: "North Kolkata" },
  { id: "Central", label: "Central Kolkata" },
  { id: "Twin-Zone", label: "North & South" },
  { id: "Heritage", label: "Bonedi Heritage" },
  { id: "Howrah", label: "Howrah" },
  { id: "East", label: "Salt Lake & East" },
];

function routeCode(route: CuratedRoute) {
  return `DPKR${String(route.number).padStart(2, "0")}`;
}

function padNumber(route: CuratedRoute) {
  return String(route.number).padStart(2, "0");
}

function likesDisplay(route: CuratedRoute, copy?: RouteCopy) {
  return copy?.likesDisplay || `${Math.floor((route.likeCount || 0) / 25) * 25}+`;
}

function allStops(route: CuratedRoute) {
  return [route.start, ...route.waypoints, route.end].filter(
    (stop): stop is NonNullable<typeof stop> => !!stop
  );
}

export default function RoutesBoard({
  routes,
  copy,
  metaByName,
}: {
  routes: CuratedRoute[];
  copy: Record<string, RouteCopy>;
  metaByName: Record<string, StopMeta>;
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const { saves, toggle: toggleSaved } = useSaves();
  const liked = saves.liked;
  const [previews, setPreviews] = useState<number[]>([]);
  const [detail, setDetail] = useState<CuratedRoute | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (window.location.hash.startsWith("#route-")) {
      const element = document.querySelector(window.location.hash);
      if (element) setTimeout(() => element.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!detail) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [detail]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return routes
      .filter((route) => {
        const c = copy[String(route.number)];
        if (filter !== "all" && c?.zone !== filter) return false;
        if (!q) return true;
        const stops = allStops(route)
          .map((stop) => `${stop.name} ${stop.locality} ${stop.nearestMetro}`)
          .join(" ");
        const haystack = [
          routeCode(route),
          String(route.number),
          route.title,
          route.bestUse,
          route.metroHub,
          c?.title,
          c?.description,
          c?.metro,
          c?.start,
          c?.finish,
          c?.earlyExits,
          c?.arrival,
          stops,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => a.number - b.number);
  }, [copy, filter, query, routes]);

  const toggleLike = async (route: CuratedRoute) => {
    const result = await toggleSaved("liked", String(route.number), route.number);
    if (!result.ok) return;
    setToast(result.saved ? "Trail liked." : "Removed from liked trails.");
  };

  const togglePreview = (route: CuratedRoute) => {
    setPreviews((previous) =>
      previous.includes(route.number)
        ? previous.filter((number) => number !== route.number)
        : [...previous, route.number]
    );
  };

  const share = async (route: CuratedRoute) => {
    const url = `${window.location.origin}/map?route=${encodeURIComponent(route.id)}`;
    const ok = await copyToClipboard(url);
    setToast(ok ? "Trail link copied." : "Copy failed — select the address bar to share.");
  };

  return (
    <div className="min-h-screen bg-transparent pb-20 pt-24 text-[#2C1210] sm:pb-16 sm:pt-28 lg:pt-32">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-col justify-between gap-2.5 sm:mb-5 md:flex-row md:items-end">
          <div>
            <div className="mb-1 inline-flex items-center rounded-full border border-[#E5C880] bg-[#FFF3D6] px-2 py-0.5 font-mono text-[10px] font-bold text-[#B45309] shadow-2xs sm:mb-1.5 sm:text-[11px]">
              30 Predefined Circuits
            </div>
            <h1 className="font-serif text-xl font-black leading-tight tracking-tight text-[#2C1210] sm:text-3xl lg:text-4xl">
              Curated Pujo Parikrama{" "}
              <span className="italic text-[#D90429]">Routes</span>
            </h1>
            <p className="mt-0.5 max-w-2xl font-sans text-[11px] leading-relaxed text-[#2C1210]/75 sm:mt-1 sm:text-sm">
              Handcrafted walking circuits, rail arrival trails, and heritage bonedi odysseys
              across Kolkata with verified transit directions and GPS waypoints.
            </p>
          </div>
          <div className="shrink-0">
            <a
              href="/map"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#FFB800]/70 bg-[#D90429] px-3 py-1.5 font-serif text-[11px] font-bold text-white shadow-sm transition-all hover:bg-[#B50321] active:scale-95 sm:px-4 sm:py-2 sm:text-sm"
            >
              <Icon name="mapPin" size={14} /> Launch Interactive Map
            </a>
          </div>
        </div>

        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center">
          <div data-routes-search className="relative w-full md:w-64">
            <Icon
              name="search"
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#2C1210]/40"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search routes, paras, pandals..."
              className="w-full rounded-full border border-[#E5C880] bg-[#FFFBF0] py-1.5 pl-8 pr-3 font-sans text-[11px] text-[#2C1210] shadow-2xs outline-none placeholder:text-[#2C1210]/35 focus:border-[#D90429]"
            />
          </div>
          <div className="no-scrollbar flex flex-1 gap-1 overflow-x-auto pb-0.5">
            {FILTERS.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`shrink-0 cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[9px] font-bold transition-all ${
                    active
                      ? "border-[#D90429] bg-[#D90429] text-white shadow-sm"
                      : "border-[#E5C880] bg-[#FFFBF0] text-[#2C1210]/70 hover:border-[#D90429] hover:text-[#D90429]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-wide text-[#2C1210]/40">
            {filtered.length} of {routes.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#E5C880] bg-[#FFFBF0] p-8 text-center">
            <Icon name="route" size={28} className="mx-auto mb-2 text-[#B45309]" />
            <p className="font-serif text-sm font-bold text-[#2C1210]">No routes match that search</p>
            <p className="mt-1 font-sans text-[10px] text-[#2C1210]/50">
              Try a route number, a para, a metro station or clear the filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="mt-3 cursor-pointer rounded-full border border-[#E5C880] bg-[#FFF3D6] px-3 py-1.5 font-serif text-[10px] font-bold text-[#B45309]"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div data-routes-grid className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((route) => {
              const c = copy[String(route.number)];
              const isPreview = previews.includes(route.number);
              const isLiked = liked.includes(route.number);
              const stops = pandalStops(route);
              return (
                <article
                  key={route.id}
                  id={`route-${padNumber(route)}`}
                  className="flex scroll-mt-28 flex-col rounded-2xl border border-[#E5C880]/75 bg-[#FFFBF0] p-3 shadow-2xs transition-all hover:border-[#D90429] sm:p-3.5"
                >
                  <div className="mb-1.5 flex flex-wrap items-start gap-1.5">
                    <span className="rounded-md bg-[#D90429]/10 px-2 py-0.5 font-mono text-[9.5px] font-black uppercase text-[#D90429]">
                      Route {routeCode(route)}
                    </span>
                    <span className="rounded-md bg-[#FFF3D6] px-2 py-0.5 font-mono text-[9.5px] font-bold text-[#B45309]">
                      {c?.zone || "Kolkata"}
                    </span>
                    <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[9px] font-bold text-[#2C1210]/55 ring-1 ring-[#E5C880]/70">
                      {c?.stops || route.stopsCount} stops
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleLike(route)}
                        aria-label={isLiked ? "Unlike route" : "Like route"}
                        className={`flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold transition-all ${
                          isLiked
                            ? "border-[#D90429] bg-[#D90429]/5 text-[#D90429]"
                            : "border-[#E5C880] bg-white text-[#2C1210]/50 hover:border-[#D90429] hover:text-[#D90429]"
                        }`}
                      >
                        <Icon name="heart" size={10} filled={isLiked} />
                        {likesDisplay(route, c)}
                      </button>
                      <button
                        type="button"
                        onClick={() => void share(route)}
                        aria-label="Share route"
                        title="Share route"
                        className="flex cursor-pointer items-center justify-center rounded-full border border-[#E5C880] bg-white p-1 text-[#2C1210]/50 hover:border-[#D90429] hover:text-[#D90429]"
                      >
                        <Icon name="share" size={10} />
                      </button>
                    </div>
                  </div>

                  <h2 className="font-serif text-sm font-black leading-snug text-[#2C1210]">
                    {c?.title || titleCase(route.title)}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-[9px] font-semibold text-[#B45309]">
                    <Icon name="transit" size={10} className="shrink-0" />
                    <span className="truncate">{c?.metro || route.metroHub}</span>
                  </p>
                  <p className="mt-1 line-clamp-2 font-sans text-[10.5px] leading-snug text-[#2C1210]/60">
                    {c?.description || route.bestUse}
                  </p>

                  {c?.arrival && (
                    <div className="mt-1.5 rounded-xl border border-[#E5C880] bg-[#FFF3D6]/60 px-2 py-1.5 font-sans text-[9.5px] leading-snug text-[#B45309]">
                      {c.arrival}
                    </div>
                  )}

                  <div className="mt-1.5 space-y-0.5 rounded-xl bg-white/70 p-2 ring-1 ring-[#E5C880]/40">
                    <div className="flex gap-1.5">
                      <span className="shrink-0 font-mono text-[8.5px] font-bold uppercase text-[#2C1210]/40">
                        Start:
                      </span>
                      <span className="font-sans text-[9.5px] font-semibold leading-snug text-[#2C1210]">
                        {c?.start || titleCase(route.start?.name || "")}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="shrink-0 font-mono text-[8.5px] font-bold uppercase text-[#2C1210]/40">
                        Finish:
                      </span>
                      <span className="font-sans text-[9.5px] leading-snug text-[#2C1210]/70">
                        {c?.finish || titleCase(route.finishLocation || "")}
                      </span>
                    </div>
                  </div>
                  {(c?.earlyExits || route.earlyExits) && (
                    <p className="mt-1 font-sans text-[9px] leading-snug text-[#2C1210]/45">
                      <span className="font-mono font-bold uppercase text-[#B45309]">
                        Early exits:
                      </span>{" "}
                      {c?.earlyExits || route.earlyExits}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => togglePreview(route)}
                    className="mt-1.5 flex cursor-pointer items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wide text-[#B45309] hover:text-[#D90429]"
                  >
                    <Icon
                      name="chevronRight"
                      size={9}
                      className={`transition-transform ${isPreview ? "rotate-90" : ""}`}
                    />
                    {isPreview ? "Hide preview" : "Quick preview"} ({stops.length} stops)
                  </button>
                  {isPreview && (
                    <div className="mt-1 max-h-52 space-y-0.5 overflow-y-auto rounded-xl border border-[#E5C880]/60 bg-white p-1.5">
                      {stops.map((stop, index) => {
                        const meta = metaByName[stop.name];
                        const label = index + 1;
                        return (
                          <div
                            key={`${stop.name}-${index}`}
                            className={`flex items-start gap-1.5 rounded-md px-1 py-0.5 ${
                              index % 2 ? "bg-[#FFFBF0]" : ""
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#B45309] font-mono text-[7px] font-bold text-white`}
                            >
                              {label}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-sans text-[9px] font-semibold text-[#2C1210]">
                                {titleCase(stop.name)}
                              </p>
                              <p className="truncate font-sans text-[8px] text-[#2C1210]/40">
                                {stop.locality}
                                {meta?.metro || stop.nearestMetro
                                  ? ` · ${meta?.metro || stop.nearestMetro}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-auto flex items-center gap-1.5 border-t border-[#DECFA6]/40 pt-2">
                    <button
                      type="button"
                      onClick={() => setDetail(route)}
                      className="flex-1 cursor-pointer rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 font-serif text-[10.5px] font-bold text-[#2C1210] shadow-2xs transition-colors hover:bg-[#FFF3D6] hover:text-[#D90429]"
                    >
                      View Details
                    </button>
                    <a
                      href={`/map?route=${encodeURIComponent(route.id)}`}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#D90429] px-2 py-1.5 font-serif text-[10.5px] font-bold text-white shadow-2xs transition-colors hover:bg-[#B50321]"
                    >
                      Open Map <Icon name="arrowUpRight" size={10} />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-[#E5C880] bg-[#FFFBF0] p-4 text-center">
          <p className="font-serif text-sm font-black text-[#2C1210]">
            Every trail is also plotted on the interactive map.
          </p>
          <p className="mt-1 font-sans text-[10px] text-[#2C1210]/55">
            Open any route to see verified stops, mode estimates, nearby pandals and Google Maps
            turn-by-turn links — or build your own Pujo trail from 617 pandals.
          </p>
          <a
            href="/map"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#FFB800]/70 bg-[#D90429] px-3 py-1.5 font-serif text-[10.5px] font-bold text-white hover:bg-[#B50321]"
          >
            <Icon name="route" size={12} /> Plan on the Interactive Map
          </a>
        </div>
      </div>

      {detail && (
        <RouteDetails
          route={detail}
          copy={copy[String(detail.number)]}
          metaByName={metaByName}
          liked={liked.includes(detail.number)}
          onLike={() => toggleLike(detail)}
          onShare={() => void share(detail)}
          onClose={() => setDetail(null)}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}

function RouteDetails({
  route,
  copy,
  metaByName,
  liked,
  onLike,
  onShare,
  onClose,
}: {
  route: CuratedRoute;
  copy?: RouteCopy;
  metaByName: Record<string, StopMeta>;
  liked: boolean;
  onLike: () => void;
  onShare: () => void;
  onClose: () => void;
}) {
  const stops = pandalStops(route);
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#1C0D0B]/55 p-0 sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Close route details"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-[#E5C880] bg-[#FFFBF0] shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 border-b border-[#E5C880] bg-[#FFFBF0]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-[#D90429] px-2 py-0.5 font-mono text-[9.5px] font-black uppercase text-white">
                  Route {routeCode(route)}
                </span>
                <span className="rounded-md bg-[#FFF3D6] px-2 py-0.5 font-mono text-[9px] font-bold text-[#B45309]">
                  {copy?.zone || "Kolkata"} · {stops.length} stops
                </span>
              </div>
              <h2 className="font-serif text-sm font-black leading-snug text-[#2C1210] sm:text-base">
                {copy?.title || titleCase(route.title)}
              </h2>
              <p className="mt-0.5 font-mono text-[9px] font-semibold text-[#B45309]">
                {copy?.metro || route.metroHub}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onLike}
                aria-label={liked ? "Unlike route" : "Like route"}
                className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 font-mono text-[9px] font-bold ${
                  liked
                    ? "border-[#D90429] bg-[#D90429]/5 text-[#D90429]"
                    : "border-[#E5C880] bg-white text-[#2C1210]/55"
                }`}
              >
                <Icon name="heart" size={11} filled={liked} />
                {likesDisplay(route, copy)}
              </button>
              <button
                type="button"
                onClick={onShare}
                aria-label="Share route"
                className="cursor-pointer rounded-full border border-[#E5C880] bg-white p-1.5 text-[#2C1210]/55 hover:text-[#D90429]"
              >
                <Icon name="share" size={12} />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close route details"
                className="cursor-pointer rounded-full border border-[#E5C880] bg-white p-1.5 text-[#2C1210]/55 hover:text-[#D90429]"
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-[#E5C880]/70 bg-white p-2.5">
              <p className="font-mono text-[8px] font-black uppercase tracking-wider text-[#B45309]">
                Starting point
              </p>
              <p className="mt-0.5 font-serif text-[11px] font-bold text-[#2C1210]">
                {titleCase(route.start?.name || copy?.start || "")}
              </p>
              <p className="font-sans text-[9px] leading-snug text-[#2C1210]/50">
                {route.start?.locality}
              </p>
              {(route.start?.nearestMetro || metaByName[route.start?.name || ""]?.metro) && (
                <p className="mt-0.5 font-mono text-[8px] font-semibold text-[#B45309]">
                  {route.start?.nearestMetro || metaByName[route.start?.name || ""]?.metro}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-[#E5C880]/70 bg-white p-2.5">
              <p className="font-mono text-[8px] font-black uppercase tracking-wider text-[#D90429]">
                Finishing point
              </p>
              <p className="mt-0.5 font-serif text-[11px] font-bold text-[#2C1210]">
                {titleCase(route.end?.name || "")}
              </p>
              <p className="font-sans text-[9px] leading-snug text-[#2C1210]/50">
                {copy?.finish || route.finishLocation}
              </p>
              {(route.end?.nearestMetro || metaByName[route.end?.name || ""]?.metro) && (
                <p className="mt-0.5 font-mono text-[8px] font-semibold text-[#B45309]">
                  {route.end?.nearestMetro || metaByName[route.end?.name || ""]?.metro}
                </p>
              )}
            </div>
          </div>

          <section>
            <h3 className="mb-1 font-serif text-[11px] font-black text-[#2C1210]">
              Curator Notes &amp; Advice
            </h3>
            <p className="font-sans text-[10px] leading-relaxed text-[#2C1210]/65">
              {copy?.description || route.bestUse}
            </p>
            {copy?.earlyExits && (
              <p className="mt-1.5 rounded-lg border border-[#E5C880]/60 bg-[#FFF3D6]/50 p-2 font-sans text-[9.5px] leading-snug text-[#2C1210]/65">
                <span className="font-mono font-bold uppercase text-[#B45309]">Early exits:</span>{" "}
                {copy.earlyExits}
              </p>
            )}
            {copy?.arrival && (
              <p className="mt-1.5 rounded-lg border border-[#E5C880] bg-[#FFF3D6]/60 p-2 font-sans text-[9.5px] leading-snug text-[#B45309]">
                {copy.arrival}
              </p>
            )}
          </section>

          {copy?.sections && copy.sections.length > 0 && (
            <section>
              <h3 className="mb-1 font-serif text-[11px] font-black text-[#2C1210]">
                Trail Walkthrough ({copy.sections.length} sections)
              </h3>
              <div className="space-y-1.5">
                {copy.sections.map((section) => (
                  <div
                    key={section.title}
                    className="rounded-lg border border-[#E5C880]/60 bg-white p-2"
                  >
                    <p className="font-mono text-[8.5px] font-bold uppercase tracking-wide text-[#D90429]">
                      {section.title}
                    </p>
                    <p className="mt-0.5 font-sans text-[9.5px] leading-snug text-[#2C1210]/70">
                      {section.stops.map((stop) => titleCase(stop)).join(" → ")}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-1 font-serif text-[11px] font-black text-[#2C1210]">
              Full Stop Sequence ({stops.length} stops)
            </h3>
            <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-xl border border-[#E5C880]/60 bg-white p-1.5">
              {stops.map((stop, index) => {
                const meta = metaByName[stop.name];
                return (
                  <div
                    key={`${stop.name}-${index}`}
                    className={`flex items-start gap-2 rounded-lg px-1.5 py-1 ${
                      index % 2 ? "bg-[#FFFBF0]" : ""
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#B45309] font-mono text-[7px] font-bold text-white`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[9.5px] font-bold uppercase leading-tight text-[#2C1210]">
                        {stop.name}
                      </p>
                      <p className="font-sans text-[8px] leading-snug text-[#2C1210]/45">
                        {stop.locality}
                        {(meta?.metro || stop.nearestMetro)
                          ? ` · ${meta?.metro || stop.nearestMetro}`
                          : ""}
                      </p>
                      {meta?.categories && meta.categories.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {meta.categories.slice(0, 2).map((category) => (
                            <span
                              key={category}
                              className="rounded bg-[#FFF3D6] px-1 py-0.5 font-mono text-[7px] font-bold uppercase text-[#B45309]"
                            >
                              {category.replace(/-/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex gap-2 border-t border-[#E5C880] pt-3">
            <a
              href={`/map?route=${encodeURIComponent(route.id)}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#D90429] px-3 py-2 font-serif text-[11px] font-bold text-white hover:bg-[#B50321]"
            >
              <Icon name="mapPin" size={12} /> Open in Interactive Map
            </a>
            <button
              type="button"
              onClick={onShare}
              className="cursor-pointer rounded-xl border border-[#E5C880] bg-white px-3 py-2 font-serif text-[11px] font-bold text-[#2C1210] hover:border-[#D90429]"
            >
              Copy link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
