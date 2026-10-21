"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { MapTab, Pandal, Poi } from "./types";
import { STORAGE, ZONES, poiIconPath, titleCase } from "./utils";
import { Icon, Spinner, Toast } from "./ui";
import { postSuggestion, uploadPhoto } from "../../lib/account";

/* ------------------------------------------------------------------ cards */

function Stars({ rating }: { rating: number | null }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating || 0)));
  return (
    <span className="inline-flex items-center gap-px text-[#D97706]" aria-label={`${rating ?? 0} out of 5`}>
      {[0, 1, 2, 3, 4].map((index) => (
        <Icon key={index} name="star" size={8} filled={index < filled} strokeWidth={8} />
      ))}
    </span>
  );
}

export function PandalCard({
  pandal,
  saved,
  onClose,
  onSave,
  onStart,
  onEnd,
  onStop,
}: {
  pandal: Pandal;
  saved: boolean;
  onClose: () => void;
  onSave: () => void;
  onStart: () => void;
  onEnd: () => void;
  onStop: () => void;
}) {
  return (
    <div className="absolute bottom-[142px] left-2 right-2 z-20 overflow-hidden rounded-2xl border border-[#E5C880] bg-[#FFFBF0] shadow-2xl sm:left-auto sm:right-3 sm:w-[340px] lg:bottom-3">
      <div className="flex gap-2 p-2.5 pr-8">
        <img
          src={pandal.image || "/pandals/maddox_square.jpg"}
          alt={titleCase(pandal.name)}
          className="h-16 w-16 shrink-0 rounded-lg border border-[#E5C880] object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-serif text-[13px] font-black leading-tight text-[#2C1210]">
            {titleCase(pandal.name)}
          </h3>
          <p className="mt-0.5 line-clamp-1 font-sans text-[9px] text-[#2C1210]/50">
            {pandal.address || pandal.locality}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Stars rating={pandal.rating} />
            <span className="font-mono text-[8px] font-bold text-[#2C1210]/45">
              {pandal.rating?.toFixed(1) ?? "—"}
            </span>
            <span className="rounded bg-[#FFF3D6] px-1 py-0.5 font-mono text-[8px] font-bold uppercase text-[#B45309]">
              {titleCase(pandal.zone)}
            </span>
            {pandal.featured && (
              <span className="rounded bg-[#D90429]/10 px-1 py-0.5 font-mono text-[8px] font-bold uppercase text-[#D90429]">
                Featured
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label="Close pandal card"
        onClick={onClose}
        className="absolute right-2 top-2 cursor-pointer rounded-full border border-[#E5C880] bg-white p-1 text-[#2C1210]/55 hover:text-[#D90429]"
      >
        <Icon name="close" size={10} />
      </button>
      <div className="flex items-center gap-1 px-2.5">
        <button
          type="button"
          onClick={onStart}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-emerald-600/30 bg-emerald-50 px-2 py-1 font-mono text-[8.5px] font-bold uppercase text-emerald-700 hover:bg-emerald-100"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Start
        </button>
        <button
          type="button"
          onClick={onEnd}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#D90429]/30 bg-[#D90429]/5 px-2 py-1 font-mono text-[8.5px] font-bold uppercase text-[#D90429] hover:bg-[#D90429]/10"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#D90429]" /> End
        </button>
        <button
          type="button"
          onClick={onStop}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#E5C880] bg-white px-2 py-1 font-mono text-[8.5px] font-bold uppercase text-[#2C1210] hover:border-[#D90429]"
        >
          <Icon name="plus" size={9} /> Stop
        </button>
        <button
          type="button"
          onClick={onSave}
          aria-label={saved ? "Remove saved pandal" : "Save pandal"}
          className={`cursor-pointer rounded-lg border p-1.5 ${
            saved
              ? "border-[#D90429] bg-[#D90429]/5 text-[#D90429]"
              : "border-[#E5C880] bg-white text-[#2C1210]/55 hover:text-[#D90429]"
          }`}
        >
          <Icon name="bookmark" size={11} filled={saved} />
        </button>
      </div>
      <a
        href={`/paras/${pandal.slug}`}
        className="mt-1.5 flex items-center justify-center gap-1 border-t border-[#E5C880]/60 bg-[#FFF3D6]/70 py-1.5 font-serif text-[10px] font-bold text-[#D90429] hover:bg-[#FFF3D6]"
      >
        Explore Details <Icon name="arrowRight" size={10} />
      </a>
    </div>
  );
}

export function PoiCard({
  poi,
  onClose,
  onStart,
  onEnd,
  onStop,
}: {
  poi: Poi;
  onClose: () => void;
  onStart: () => void;
  onEnd: () => void;
  onStop: () => void;
}) {
  return (
    <div className="absolute bottom-[142px] left-2 right-2 z-20 overflow-hidden rounded-2xl border border-[#E5C880] bg-[#FFFBF0] shadow-2xl sm:left-auto sm:right-3 sm:w-[300px] lg:bottom-3">
      <div className="flex items-start gap-2 p-2.5 pr-8">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5C880] bg-white">
          <img
            src={poiIconPath(poi.category)}
            alt=""
            className="h-6 w-6 object-contain"
          />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[12px] font-black leading-tight text-[#2C1210]">
            {titleCase(poi.name)}
          </h3>
          <p className="font-mono text-[8px] font-bold uppercase tracking-wide text-[#B45309]">
            {poi.category.replace(/-/g, " ")}
          </p>
          <p className="mt-0.5 line-clamp-2 font-sans text-[9px] text-[#2C1210]/50">
            {poi.address}
          </p>
          {poi.openHours && (
            <p className="mt-0.5 font-sans text-[8.5px] text-[#2C1210]/45">
              Open: {poi.openHours}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        aria-label="Close transit card"
        onClick={onClose}
        className="absolute right-2 top-2 cursor-pointer rounded-full border border-[#E5C880] bg-white p-1 text-[#2C1210]/55 hover:text-[#D90429]"
      >
        <Icon name="close" size={10} />
      </button>
      <div className="flex items-center gap-1 px-2.5 pb-2.5">
        <button
          type="button"
          onClick={onStart}
          className="flex-1 cursor-pointer rounded-lg border border-emerald-600/30 bg-emerald-50 px-2 py-1 font-mono text-[8.5px] font-bold uppercase text-emerald-700"
        >
          Start
        </button>
        <button
          type="button"
          onClick={onEnd}
          className="flex-1 cursor-pointer rounded-lg border border-[#D90429]/30 bg-[#D90429]/5 px-2 py-1 font-mono text-[8.5px] font-bold uppercase text-[#D90429]"
        >
          End
        </button>
        <button
          type="button"
          onClick={onStop}
          className="flex-1 cursor-pointer rounded-lg border border-[#E5C880] bg-white px-2 py-1 font-mono text-[8.5px] font-bold uppercase text-[#2C1210]"
        >
          + Stop
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- install */

export function InstallBanner({ variant = "sidebar" }: { variant?: "sidebar" | "floating" }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const promptRef = useRef<{ prompt: () => Promise<void>; userChoice?: Promise<unknown> } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE.installDismissed);
      const dismissedAt = raw ? Number(raw) : 0;
      if (dismissedAt && Date.now() - dismissedAt < 24 * 60 * 60 * 1000) return;
    } catch {
      /* noop */
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    setVisible(true);
    const handler = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as unknown as {
        prompt: () => Promise<void>;
        userChoice?: Promise<unknown>;
      };
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE.installDismissed, String(Date.now()));
    } catch {
      /* noop */
    }
  };

  const install = async () => {
    if (promptRef.current) {
      await promptRef.current.prompt();
      await promptRef.current.userChoice?.catch(() => {});
      promptRef.current = null;
      dismiss();
      return;
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setMessage(
      isIos
        ? "Tap Share, then “Add to Home Screen”."
        : "Open your browser menu and choose “Install app”."
    );
  };

  if (!visible) return null;

  if (variant === "floating") {
    return (
      <div className="absolute right-2.5 top-[204px] z-20 w-[230px] rounded-xl border border-[#E5C880] bg-[#FFFBF0]/95 p-2 shadow-lg backdrop-blur lg:hidden">
        <div className="flex items-start gap-1.5">
          <img src="/map/featured_pandals.png" alt="" className="h-7 w-6 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[10px] font-black leading-tight text-[#2C1210]">
              Add Sharodsamagam
            </p>
            <p className="font-sans text-[8px] text-[#2C1210]/50">Offline Map &amp; Guide 2026</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss install banner"
            onClick={dismiss}
            className="cursor-pointer p-0.5 text-[#2C1210]/40"
          >
            <Icon name="close" size={9} />
          </button>
        </div>
        {message && (
          <p className="mt-1 rounded bg-[#FFF3D6] px-1.5 py-1 font-sans text-[8px] leading-snug text-[#B45309]">
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={install}
          className="mt-1 w-full cursor-pointer rounded-md bg-[#D90429] py-1 font-mono text-[8px] font-black uppercase tracking-wide text-white"
        >
          Install
        </button>
      </div>
    );
  }

  return (
    <div className="relative mt-2 shrink-0 overflow-hidden rounded-xl border border-[#E5C880] bg-[#FFF3D6]/70 p-2">
      <div className="flex items-start gap-2">
        <img src="/map/featured_pandals.png" alt="" className="h-8 w-7 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[10.5px] font-black leading-tight text-[#2C1210]">
            Add Sharodsamagam
          </p>
          <p className="font-sans text-[8.5px] text-[#2C1210]/50">Offline Map &amp; Guide 2026</p>
        </div>
        <button
          type="button"
          onClick={install}
          className="shrink-0 cursor-pointer rounded-md bg-[#D90429] px-2 py-1 font-mono text-[8px] font-black uppercase tracking-wide text-white hover:bg-[#B50321]"
        >
          Install
        </button>
        <button
          type="button"
          aria-label="Dismiss install banner"
          onClick={dismiss}
          className="shrink-0 cursor-pointer p-0.5 text-[#2C1210]/40 hover:text-[#D90429]"
        >
          <Icon name="close" size={10} />
        </button>
      </div>
      {message && (
        <p className="mt-1 rounded bg-white/70 px-1.5 py-1 font-sans text-[8px] leading-snug text-[#B45309]">
          {message}
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- mobile panel */

export function MobilePanel({
  open,
  tab,
  onTab,
  onClose,
  filters,
  trails,
  planner,
  ai,
}: {
  open: boolean;
  tab: MapTab;
  onTab: (tab: MapTab) => void;
  onClose: () => void;
  filters: ReactNode;
  trails: ReactNode;
  planner: ReactNode;
  ai: ReactNode;
}) {
  if (!open) return null;
  return (
    <div data-mobile-panel className="fixed inset-0 z-[80] flex flex-col bg-[#FFFBF0] lg:hidden">
      <div className="relative shrink-0 overflow-hidden bg-[#2C1210] px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-[#FFFBF0]">
        <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full border border-[#E5C880]/20" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="font-serif text-sm font-black leading-tight">Sharodsamagam</p>
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-[#E5C880]/70">
              UNESCO Heritage 2026
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="cursor-pointer rounded-full border border-[#E5C880]/40 p-1.5 text-[#FFFBF0]"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="relative mt-2 grid grid-cols-4 gap-1 rounded-xl border border-[#E5C880]/25 bg-white/5 p-1">
          {(
            [
              ["filters", "Filter & POIs"],
              ["trails", "Curated Trails"],
              ["planner", "Route Planner"],
              ["ai", "AI Planner"],
            ] as [MapTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onTab(id)}
              className={`cursor-pointer rounded-lg px-1 py-1.5 font-mono text-[9px] font-bold transition-all ${
                tab === id
                  ? "bg-[#FFFBF0] text-[#D90429] shadow-sm"
                  : "text-[#FFFBF0]/65"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        data-mobile-panel-body
        className="min-h-0 flex-1 overflow-y-auto p-3 pb-[calc(5rem+env(safe-area-inset-bottom))]"
      >
        {tab === "filters" && filters}
        {tab === "trails" && trails}
        {tab === "planner" && planner}
        {tab === "ai" && ai}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- route sheet */

export function RouteSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end bg-[#1C0D0B]/40 lg:hidden">
      <button
        type="button"
        aria-label="Close route planner"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] flex-col rounded-t-3xl border-t-2 border-[#E5C880] bg-[#FFFBF0] shadow-2xl">
        <div className="shrink-0 px-3 pb-2 pt-2">
          <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-[#2C1210]/20" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[#B45309]">
                Plan your route
              </p>
              <p className="font-serif text-sm font-black text-[#2C1210]">
                Kolkata Durga Puja GIS Trail
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close route planner"
              className="cursor-pointer rounded-full border border-[#E5C880] p-1.5 text-[#2C1210]/60"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        </div>
        <div
          data-route-sheet-body
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(5rem+env(safe-area-inset-bottom))]"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- nearby sheet */

export function NearbySheet({
  open,
  onClose,
  status,
  pandals,
  onLocate,
  onSelect,
  onExplore,
}: {
  open: boolean;
  onClose: () => void;
  status: "idle" | "loading" | "ready" | "denied" | "error";
  pandals: { pandal: Pandal; distanceM: number }[];
  onLocate: () => void;
  onSelect: (pandal: Pandal) => void;
  onExplore: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end bg-[#1C0D0B]/40 lg:hidden">
      <button
        type="button"
        aria-label="Close nearby pandals"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[72vh] flex-col rounded-t-3xl border-t-2 border-[#E5C880] bg-[#FFFBF0] shadow-2xl">
        <div className="shrink-0 px-3 pb-2 pt-2">
          <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-[#2C1210]/20" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[#B45309]">
                Around you
              </p>
              <p className="font-serif text-sm font-black text-[#2C1210]">Nearby Pandals</p>
              <p className="font-sans text-[9px] text-[#2C1210]/45">Within 500 m of your location</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close nearby pandals"
              className="cursor-pointer rounded-full border border-[#E5C880] p-1.5 text-[#2C1210]/60"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          {(status === "idle" || status === "denied" || status === "error") && (
            <div className="rounded-2xl border border-[#E5C880] bg-white p-3 text-center">
              <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF3D6] text-[#D90429]">
                <Icon name="locate" size={20} />
              </span>
              <p className="font-serif text-[12px] font-bold text-[#2C1210]">
                {status === "denied"
                  ? "Location permission was denied"
                  : status === "error"
                    ? "We couldn't get your location"
                    : "Find pandals around you"}
              </p>
              <p className="mx-auto mt-1 max-w-[260px] font-sans text-[9.5px] leading-snug text-[#2C1210]/50">
                {status === "denied"
                  ? "Allow location access in your browser settings, then try again."
                  : "We use your location only on this device to sort pandals by walking distance."}
              </p>
              <button
                type="button"
                onClick={onLocate}
                className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#D90429] px-3 py-1.5 font-serif text-[10px] font-bold text-white"
              >
                <Icon name="gps" size={12} /> Use my location
              </button>
            </div>
          )}
          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-[#E5C880] bg-white p-4 font-mono text-[9px] text-[#B45309]">
              <Spinner size={14} /> Finding pandals near you...
            </div>
          )}
          {status === "ready" && pandals.length === 0 && (
            <div className="rounded-2xl border border-[#E5C880] bg-white p-3 text-center">
              <p className="font-serif text-[12px] font-bold text-[#2C1210]">No pandals within 500 m</p>
              <p className="mt-1 font-sans text-[9.5px] text-[#2C1210]/50">
                Move closer to a para or explore the full map.
              </p>
              <button
                type="button"
                onClick={onExplore}
                className="mt-2 cursor-pointer rounded-full border border-[#E5C880] bg-[#FFF3D6] px-3 py-1.5 font-serif text-[10px] font-bold text-[#B45309]"
              >
                Explore all pandals
              </button>
            </div>
          )}
          {status === "ready" && pandals.length > 0 && (
            <div className="space-y-1.5">
              {pandals.map(({ pandal, distanceM }) => (
                <button
                  key={pandal.slug}
                  type="button"
                  onClick={() => onSelect(pandal)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-[#E5C880]/70 bg-white p-2 text-left transition-colors hover:border-[#D90429]"
                >
                  <img
                    src={pandal.image || "/pandals/maddox_square.jpg"}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[11px] font-bold text-[#2C1210]">
                      {titleCase(pandal.name)}
                    </p>
                    <p className="truncate font-sans text-[8.5px] text-[#2C1210]/45">
                      {pandal.locality}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="rounded bg-[#FFF3D6] px-1 py-0.5 font-mono text-[8px] font-bold text-[#B45309]">
                        {Math.round(distanceM)} m
                      </span>
                      {pandal.featured && (
                        <span className="rounded bg-[#D90429]/10 px-1 py-0.5 font-mono text-[8px] font-bold text-[#D90429]">
                          Featured
                        </span>
                      )}
                    </div>
                  </div>
                  <Icon name="chevronRight" size={13} className="shrink-0 text-[#2C1210]/30" />
                </button>
              ))}
              <button
                type="button"
                onClick={onLocate}
                className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#E5C880] bg-white py-1.5 font-mono text-[8.5px] font-bold uppercase text-[#B45309]"
              >
                <Icon name="gps" size={10} /> Refresh location
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- suggest modal */

function MiniPinMap({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let map: { remove: () => void } | null = null;
    (async () => {
      if (!nodeRef.current) return;
      const L = (await import("leaflet")).default;
      if (cancelled || !nodeRef.current) return;
      const instance = L.map(nodeRef.current, {
        center: [lat, lng],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(instance);
      const icon = L.divIcon({
        className: "suggest-pin",
        html: '<div style="width:24px;height:32px;"><svg viewBox="0 0 256 256" width="24" height="32" fill="#D90429" stroke="#FFFBF0" stroke-width="10"><path d="M128,16a88,88,0,0,0-88,88c0,72,88,136,88,136s88-64,88-136A88,88,0,0,0,128,16Z"/><circle cx="128" cy="104" r="28" fill="#FFFBF0" stroke="none"/></svg></div>',
        iconSize: [24, 32],
        iconAnchor: [12, 32],
      });
      let marker = L.marker([lat, lng], { icon, draggable: true }).addTo(instance);
      const place = (nextLat: number, nextLng: number) => {
        onChange(nextLat, nextLng);
        marker.setLatLng([nextLat, nextLng]);
      };
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChange(p.lat, p.lng);
      });
      instance.on("click", (event: { latlng: { lat: number; lng: number } }) => {
        marker.remove();
        marker = L.marker([event.latlng.lat, event.latlng.lng], { icon, draggable: true }).addTo(instance);
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          onChange(p.lat, p.lng);
        });
        place(event.latlng.lat, event.latlng.lng);
      });
      mapRef.current = instance;
      map = instance;
      setTimeout(() => instance.invalidateSize(), 150);
    })().catch(() => {});
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // The map is intentionally created once; coordinate updates are handled by the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={nodeRef}
      className="h-36 w-full overflow-hidden rounded-lg border border-[#E5C880]"
      data-suggest-map
    />
  );
}

export function SuggestModal({
  open,
  onClose,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    zone: "",
    locality: "",
    theme: "",
    contact: "",
    phone: "",
    email: "",
    lat: 22.5726,
    lng: 88.3639,
  });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  if (!open) return null;

  const update = (patch: Partial<typeof form>) =>
    setForm((previous) => ({ ...previous, ...patch }));

  const submit = async () => {
    if (!form.name.trim() || !form.zone || !form.contact.trim() || !form.phone.trim()) {
      setError("Pandal name, zone, your name and phone are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let photoId: string | undefined;
      if (photoFile) {
        const uploaded = await uploadPhoto(photoFile, form.name, form.theme);
        if (!uploaded) {
          setError("The photo could not be uploaded. Try without it.");
          setBusy(false);
          return;
        }
        photoId = uploaded.id;
      }
      const ok = await postSuggestion({
        name: form.name.trim(),
        locality: [form.locality.trim(), form.zone].filter(Boolean).join(", "),
        lat: form.lat,
        lng: form.lng,
        note: [form.theme.trim(), form.contact.trim(), form.phone.trim(), form.email.trim()]
          .filter(Boolean)
          .join(" - "),
        photoId,
      });
      if (!ok) {
        setError("The suggestion could not be sent. Please try again.");
        setBusy(false);
        return;
      }
      setDone(true);
      onToast("Suggestion sent to the Sharodsamagam team.");
    } catch {
      setError("The suggestion could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setForm({
      name: "",
      zone: "",
      locality: "",
      theme: "",
      contact: "",
      phone: "",
      email: "",
      lat: 22.5726,
      lng: 88.3639,
    });
    setDone(false);
    setError("");
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[#1C0D0B]/50 p-0 lg:items-center lg:p-6">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#E5C880] bg-[#FFFBF0] shadow-2xl lg:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-[#E5C880] bg-[#FFFBF0] px-4 py-3">
          <div>
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[#B45309]">
              Help the community
            </p>
            <h2 className="font-serif text-base font-black text-[#2C1210]">Add a Pandal</h2>
            <p className="font-sans text-[9px] text-[#2C1210]/45">
              Missing a para puja? Share the details below.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add pandal"
            className="cursor-pointer rounded-full border border-[#E5C880] p-1.5 text-[#2C1210]/55"
          >
            <Icon name="close" size={13} />
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center">
            <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Icon name="check" size={24} />
            </span>
            <p className="font-serif text-base font-black text-[#2C1210]">Suggestion saved</p>
            <p className="mx-auto mt-1 max-w-xs font-sans text-[10px] leading-relaxed text-[#2C1210]/55">
              The Sharodsamagam team will review it. If you added a photo it is queued for
              approval too.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="cursor-pointer rounded-full border border-[#E5C880] bg-white px-3 py-1.5 font-serif text-[10px] font-bold text-[#2C1210]"
              >
                Add another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-full bg-[#D90429] px-3 py-1.5 font-serif text-[10px] font-bold text-white"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 p-4">
            {error && (
              <p className="rounded-lg border border-[#D90429]/30 bg-[#D90429]/5 px-2 py-1.5 font-sans text-[9px] font-semibold text-[#D90429]">
                {error}
              </p>
            )}
            <Field label="Pandal / Para Name" required>
              <input
                value={form.name}
                onChange={(event) => update({ name: event.target.value })}
                placeholder="e.g. Tridhara Sammilani"
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Zone" required>
                <select
                  value={form.zone}
                  onChange={(event) => update({ zone: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Select zone</option>
                  {ZONES.filter((zone) => zone.id !== "all").map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Locality / landmark">
                <input
                  value={form.locality}
                  onChange={(event) => update({ locality: event.target.value })}
                  placeholder="Street or para"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Theme or notes">
              <textarea
                value={form.theme}
                onChange={(event) => update({ theme: event.target.value })}
                placeholder="Theme, crowd tips, nearest metro..."
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </Field>
            <div>
              <p className="mb-1 font-mono text-[8px] font-black uppercase tracking-wider text-[#2C1210]/45">
                Drop a pin (optional)
              </p>
              <MiniPinMap
                lat={form.lat}
                lng={form.lng}
                onChange={(lat, lng) => update({ lat, lng })}
              />
              <p className="mt-0.5 text-right font-mono text-[8px] text-[#2C1210]/35">
                {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
              </p>
            </div>
            <Field label="Add a photo (optional)">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
                className="w-full cursor-pointer rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 font-mono text-[9px] text-[#2C1210]/60"
              />
              {photoFile && (
                <p className="mt-1 font-mono text-[8px] text-[#B45309]">{photoFile.name}</p>
              )}
            </Field>
            <div className="rounded-lg border border-[#E5C880]/70 bg-[#FFF3D6]/50 p-2">
              <p className="mb-1.5 font-mono text-[8px] font-black uppercase tracking-wider text-[#B45309]">
                Your contact details
              </p>
              <div className="space-y-2">
                <Field label="Your name" required>
                  <input
                    value={form.contact}
                    onChange={(event) => update({ contact: event.target.value })}
                    className={inputClass}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="WhatsApp / Phone" required>
                    <input
                      value={form.phone}
                      onChange={(event) => update({ phone: event.target.value })}
                      inputMode="tel"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Email (optional)">
                    <input
                      value={form.email}
                      onChange={(event) => update({ email: event.target.value })}
                      inputMode="email"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 cursor-pointer rounded-xl border border-[#E5C880] bg-white py-2 font-serif text-[11px] font-bold text-[#2C1210]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                className="flex-1 cursor-pointer rounded-xl bg-[#D90429] py-2 font-serif text-[11px] font-bold text-white hover:bg-[#B50321]"
              >
                Submit Suggestion
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 font-sans text-[10.5px] text-[#2C1210] outline-none placeholder:text-[#2C1210]/30 focus:border-[#D90429]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block font-mono text-[8px] font-black uppercase tracking-wider text-[#2C1210]/45">
        {label}
        {required && <span className="text-[#D90429]"> *</span>}
      </span>
      {children}
    </label>
  );
}

export { Toast };
