"use client";

import type { ReactNode } from "react";
import { MODE_META, MODE_ORDER, formatSeconds } from "./utils";
import type { TravelMode } from "./types";

type IconName =
  | "search"
  | "filter"
  | "close"
  | "chevronDown"
  | "chevronRight"
  | "chevronLeft"
  | "arrowRight"
  | "arrowUpRight"
  | "plus"
  | "minus"
  | "heart"
  | "share"
  | "bookmark"
  | "star"
  | "walk"
  | "drive"
  | "cycle"
  | "transit"
  | "clock"
  | "route"
  | "mapPin"
  | "layers"
  | "locate"
  | "sparkle"
  | "temple"
  | "external"
  | "swap"
  | "gps"
  | "info"
  | "check"
  | "users"
  | "trash"
  | "google"
  | "flame"
  | "calendar"
  | "compass"
  | "menu";

const PATHS: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="112" cy="112" r="80" />
      <line x1="168" y1="168" x2="224" y2="224" />
    </>
  ),
  filter: (
    <>
      <line x1="24" y1="64" x2="232" y2="64" />
      <line x1="64" y1="128" x2="192" y2="128" />
      <line x1="104" y1="192" x2="152" y2="192" />
    </>
  ),
  close: (
    <>
      <line x1="48" y1="48" x2="208" y2="208" />
      <line x1="208" y1="48" x2="48" y2="208" />
    </>
  ),
  chevronDown: <polyline points="48 96 128 176 208 96" />,
  chevronRight: <polyline points="96 48 176 128 96 208" />,
  chevronLeft: <polyline points="160 48 80 128 160 208" />,
  arrowRight: (
    <>
      <line x1="40" y1="128" x2="216" y2="128" />
      <polyline points="152 64 216 128 152 192" />
    </>
  ),
  arrowUpRight: (
    <>
      <line x1="64" y1="192" x2="192" y2="64" />
      <polyline points="96 64 192 64 192 160" />
    </>
  ),
  plus: (
    <>
      <line x1="40" y1="128" x2="216" y2="128" />
      <line x1="128" y1="40" x2="128" y2="216" />
    </>
  ),
  minus: <line x1="40" y1="128" x2="216" y2="128" />,
  heart: <path d="M128,224S24,168,24,96a56,56,0,0,1,104-30,56,56,0,0,1,104,30C232,168,128,224,128,224Z" />,
  share: (
    <>
      <circle cx="64" cy="128" r="32" />
      <circle cx="192" cy="64" r="32" />
      <circle cx="192" cy="192" r="32" />
      <line x1="92" y1="112" x2="164" y2="80" />
      <line x1="92" y1="144" x2="164" y2="176" />
    </>
  ),
  bookmark: <path d="M56,32H200a8,8,0,0,1,8,8V224l-80-48L48,224V40A8,8,0,0,1,56,32Z" />,
  star: <polygon points="128 24 158 92 232 100 176 150 192 224 128 186 64 224 80 150 24 100 98 92 128 24" />,
  walk: (
    <>
      <circle cx="152" cy="48" r="24" />
      <polyline points="144 88 112 136 152 168 136 224" />
      <polyline points="112 136 72 168 48 128" />
      <line x1="152" y1="168" x2="200" y2="200" />
    </>
  ),
  drive: (
    <>
      <path d="M40,144l24-64h128l24,64" />
      <rect x="32" y="136" width="192" height="56" rx="16" />
      <circle cx="76" cy="196" r="12" />
      <circle cx="180" cy="196" r="12" />
    </>
  ),
  cycle: (
    <>
      <circle cx="72" cy="176" r="40" />
      <circle cx="184" cy="176" r="40" />
      <polyline points="72 176 112 96 160 176 128 176 104 128" />
      <line x1="160" y1="96" x2="200" y2="96" />
    </>
  ),
  transit: (
    <>
      <rect x="48" y="32" width="160" height="152" rx="24" />
      <line x1="72" y1="96" x2="184" y2="96" />
      <circle cx="88" cy="136" r="8" />
      <circle cx="168" cy="136" r="8" />
      <line x1="96" y1="184" x2="64" y2="232" />
      <line x1="160" y1="184" x2="192" y2="232" />
    </>
  ),
  clock: (
    <>
      <circle cx="128" cy="128" r="96" />
      <polyline points="128 64 128 128 176 152" />
    </>
  ),
  route: (
    <>
      <circle cx="56" cy="72" r="24" />
      <circle cx="200" cy="184" r="24" />
      <path d="M80,72h64a48,48,0,0,1,0,96H112a32,32,0,0,0,0,64" />
    </>
  ),
  mapPin: (
    <>
      <path d="M128,16a88,88,0,0,0-88,88c0,72,88,136,88,136s88-64,88-136A88,88,0,0,0,128,16Z" />
      <circle cx="128" cy="104" r="32" />
    </>
  ),
  layers: (
    <>
      <polygon points="128 32 224 80 128 128 32 80" />
      <polyline points="32 128 128 176 224 128" />
      <polyline points="32 176 128 224 224 176" />
    </>
  ),
  locate: (
    <>
      <circle cx="128" cy="128" r="40" />
      <line x1="128" y1="16" x2="128" y2="56" />
      <line x1="128" y1="200" x2="128" y2="240" />
      <line x1="16" y1="128" x2="56" y2="128" />
      <line x1="200" y1="128" x2="240" y2="128" />
    </>
  ),
  sparkle: (
    <>
      <path d="M128,24l20,64,64,20-64,20-20,64-20-64-64-20,64-20Z" />
      <path d="M208,160l8,24,24,8-24,8-8,24-8-24-24-8,24-8Z" />
    </>
  ),
  temple: (
    <>
      <path d="M48,104L128,40l80,64" />
      <path d="M64,104V216H192V104" />
      <line x1="40" y1="216" x2="216" y2="216" />
      <line x1="104" y1="216" x2="104" y2="152" />
      <line x1="152" y1="216" x2="152" y2="152" />
      <line x1="104" y1="152" x2="152" y2="152" />
    </>
  ),
  external: (
    <>
      <path d="M120,48H48V208H208V136" />
      <line x1="112" y1="144" x2="216" y2="40" />
      <polyline points="160 40 216 40 216 96" />
    </>
  ),
  swap: (
    <>
      <polyline points="88 40 40 88 88 136" />
      <line x1="40" y1="88" x2="200" y2="88" />
      <polyline points="168 120 216 168 168 216" />
      <line x1="56" y1="168" x2="216" y2="168" />
    </>
  ),
  gps: (
    <>
      <circle cx="128" cy="128" r="40" />
      <circle cx="128" cy="128" r="8" fill="currentColor" />
      <line x1="128" y1="16" x2="128" y2="56" />
      <line x1="128" y1="200" x2="128" y2="240" />
      <line x1="16" y1="128" x2="56" y2="128" />
      <line x1="200" y1="128" x2="240" y2="128" />
    </>
  ),
  info: (
    <>
      <circle cx="128" cy="128" r="96" />
      <line x1="128" y1="112" x2="128" y2="176" />
      <circle cx="128" cy="80" r="8" fill="currentColor" />
    </>
  ),
  check: <polyline points="48 136 104 192 208 64" />,
  users: (
    <>
      <circle cx="96" cy="88" r="40" />
      <path d="M24,216c0-48,32-72,72-72s72,24,72,72" />
      <circle cx="184" cy="88" r="32" />
      <path d="M176,144c32,0,56,24,56,56" />
    </>
  ),
  trash: (
    <>
      <line x1="40" y1="56" x2="216" y2="56" />
      <path d="M56,56l8,168H192l8-168" />
      <path d="M96,56V32h64V56" />
      <line x1="104" y1="96" x2="104" y2="184" />
      <line x1="152" y1="96" x2="152" y2="184" />
    </>
  ),
  google: (
    <>
      <path d="M216,128a88,88,0,1,1-24-60" />
      <polyline points="216 40 216 104 152 104" />
    </>
  ),
  flame: <path d="M128,24c0,48-64,64-64,128a64,64,0,0,0,128,0C192,88,128,72,128,24Z" />,
  calendar: (
    <>
      <rect x="40" y="48" width="176" height="176" rx="16" />
      <line x1="40" y1="96" x2="216" y2="96" />
      <line x1="80" y1="24" x2="80" y2="64" />
      <line x1="176" y1="24" x2="176" y2="64" />
    </>
  ),
  compass: (
    <>
      <circle cx="128" cy="128" r="96" />
      <polygon points="168 88 144 144 88 168 112 112 168 88" />
    </>
  ),
  menu: (
    <>
      <line x1="32" y1="64" x2="224" y2="64" />
      <line x1="32" y1="128" x2="224" y2="128" />
      <line x1="32" y1="192" x2="224" y2="192" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  className = "",
  filled = false,
  strokeWidth = 16,
}: {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean;
  strokeWidth?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export const MODE_ICONS: Record<TravelMode, IconName> = {
  walk: "walk",
  drive: "drive",
  cycle: "cycle",
  transit: "transit",
};

export function ModeTabs({
  active,
  seconds,
  onChange,
  compact = false,
}: {
  active: TravelMode;
  seconds: Record<TravelMode, number | null> | null;
  onChange: (mode: TravelMode) => void;
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl border border-[#E5C880] bg-[#FFF3D6] p-1">
      {MODE_ORDER.map((mode) => {
        const selected = active === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg ${
              compact ? "py-1" : "py-1.5"
            } transition-all ${
              selected
                ? "bg-white text-[#D90429] shadow-sm"
                : "text-[#2C1210]/55 hover:text-[#2C1210]"
            }`}
          >
            <span className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wide">
              <Icon name={MODE_ICONS[mode]} size={11} />
              {MODE_META[mode].label}
            </span>
            <span
              className={`mt-0.5 font-serif text-[11px] font-black ${
                selected ? "text-[#D90429]" : "text-[#2C1210]/75"
              }`}
            >
              {seconds?.[mode] ? formatSeconds(seconds[mode]) : "--"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Spinner({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <button
      type="button"
      onClick={onDone}
      className="fixed bottom-24 left-1/2 z-[120] -translate-x-1/2 cursor-pointer rounded-full border border-[#E5C880] bg-[#2C1210] px-4 py-2 text-center font-serif text-[12px] font-bold text-[#FFFBF0] shadow-xl lg:bottom-8"
    >
      {message}
    </button>
  );
}
