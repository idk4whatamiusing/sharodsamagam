"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

const dhakGlobal: { el: HTMLAudioElement | null } = { el: null };
const audioGlobal: { el: HTMLAudioElement | null } = { el: null };

type Track = { title: string; artist: string; filename: string; durationLabel: string };

const TABS = ["All", "Hits", "mahalaya", "traditional"];

export default function AudioPlayer({ tracks }: { tracks: Track[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dhakRef = useRef<HTMLAudioElement | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dhakOn, setDhakOn] = useState(false);
  // Collapsed by default — the panel must never auto-open on reload.
  // An explicit user toggle is remembered, but a fresh visit always starts shut.
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("All");
  const [elapsed, setElapsed] = useState(0);

  // The mobile navbar ships an empty action slot beside the wordmark. The
  // slot lives in raw mirror HTML (not React-managed), so it is resolved
  // after mount and rendered into with a portal. Deferred so the portal is
  // never part of the server render and cannot cause a hydration mismatch.
  const [navSlot, setNavSlot] = useState<HTMLElement | null>(null);
  const pathname = usePathname();

  const current = tracks[idx];

  useEffect(() => {
    setNavSlot(document.getElementById("mobile-nav-actions"));
    // Same latent bug as the page-scoped components: the layout outlives the
    // page, so the slot node is only guaranteed to be looked up on entry.
    // The audio setup effects below must stay dependency-free or playback
    // state resets on every navigation.
  }, [pathname]);

  useEffect(() => {
    if (!dhakGlobal.el) {
      dhakGlobal.el = new Audio("/sounds/dhak1.mp3");
      dhakGlobal.el.loop = true;
      dhakGlobal.el.volume = 0.5;
    }
    dhakRef.current = dhakGlobal.el;
    if (!audioGlobal.el) audioGlobal.el = new Audio();
    audioRef.current = audioGlobal.el;
    audioGlobal.el.onended = () => play((idx + 1) % tracks.length);
    setPlaying(!audioGlobal.el.paused);
    try {
      if (localStorage.getItem("dhak_pref") === "playing") {
        dhakGlobal.el.play().catch(() => {});
        setDhakOn(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const t = setInterval(() => setElapsed(el.currentTime), 500);
    return () => clearInterval(t);
  }, []);

  const play = (i: number) => {
    setIdx(i);
    setPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = `/Songs/${tracks[i].filename.split("/").pop()}`;
      audioRef.current.play().catch(() => {});
    }
  };
  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else {
      if (!audioRef.current.src) return play(0);
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };
  const toggleDhak = () => {
    const dhak = dhakGlobal.el!;
    if (dhakOn) { dhak.pause(); setDhakOn(false); try { localStorage.setItem("dhak_pref", "muted"); } catch {} }
    else { dhak.play().catch(() => {}); setDhakOn(true); try { localStorage.setItem("dhak_pref", "playing"); } catch {} }
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const filtered = tracks.filter((t) => (tab === "All" ? true : t.artist.toLowerCase().includes(tab) || t.title.toLowerCase().includes(tab)));
  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setElapsed(v);
    if (audioRef.current) audioRef.current.currentTime = v;
  };
  const setVol = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <>
      {/* Floating controls for desktop. Hidden below lg because the mobile
          navbar carries its own copy in #mobile-nav-actions. */}
      <button onClick={toggleDhak} aria-label="Dhak"
        className={`hidden lg:flex fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-xl border-2 border-white items-center justify-center text-lg ${dhakOn ? "bg-[#D90429] text-white" : "bg-white text-[#2C1210]"}`}>🥁</button>
      <button onClick={() => setOpen(!open)} aria-label="Playlist"
        className="hidden lg:flex fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full bg-white border border-[#EAD5A0] shadow-xl items-center justify-center text-lg">🎵</button>

      {/* Same controls, same handlers, same state — rendered into the mobile
          navbar. The parent header is `lg:hidden`, so these disappear on
          desktop with no extra breakpoint logic here. */}
      {navSlot &&
        createPortal(
          <>
            <button onClick={toggleDhak} aria-label="Dhak" aria-pressed={dhakOn} title={dhakOn ? "Mute dhak" : "Play dhak"}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base shrink-0 transition-transform active:scale-95 border ${
                dhakOn
                  ? "bg-[#D90429] text-white border-[#D90429]"
                  : "bg-white/70 text-[#2C1210] border-[#E5C880]"
              }`}>🥁</button>
            <button onClick={() => setOpen(!open)} aria-label="Playlist" aria-pressed={open} title={open ? "Hide playlist" : "Open playlist"}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base shrink-0 transition-transform active:scale-95 border ${
                open
                  ? "bg-[#D90429] text-white border-[#D90429]"
                  : "bg-white/70 text-[#2C1210] border-[#E5C880]"
              }`}>🎵</button>
          </>,
          navSlot
        )}

      {open && (
        <aside className="fixed right-4 top-20 bottom-20 w-[320px] max-w-[88vw] z-50 bg-white border border-[#EAD5A0] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#EAD5A0]">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-black text-[#2C1210] text-lg">🪔 Pujar Aalo Radio</h3>
              <button onClick={() => setOpen(false)} className="text-[#2C1210]/50 text-lg">✕</button>
            </div>
            <p className="text-[10px] font-mono font-black tracking-widest text-[#D97706]">DURGA PUJA LIVE SOUNDS</p>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono uppercase bg-amber-100 text-amber-700">{playing ? "PLAYING" : "PAUSED"}</span>
          </div>
          <div className="p-4 border-b border-[#EAD5A0] space-y-3">
            <div className="flex items-center gap-3">
              <button onClick={() => play((idx - 1 + tracks.length) % tracks.length)} className="w-8 h-8 rounded-full bg-stone-100 text-[#2C1210] flex items-center justify-center" aria-label="Prev">⏮</button>
              <button onClick={toggle} className="w-11 h-11 rounded-full bg-[#D90429] text-white font-bold flex items-center justify-center">{playing ? "❚❚" : "▶"}</button>
              <button onClick={() => play((idx + 1) % tracks.length)} className="w-8 h-8 rounded-full bg-stone-100 text-[#2C1210] flex items-center justify-center" aria-label="Next">⏭</button>
              <div className="min-w-0 flex-1">
                <p className="font-serif font-bold text-[#2C1210] truncate">{current ? current.title : "—"}</p>
                <p className="text-[11px] text-[#2C1210]/60">{current ? current.artist : ""}</p>
                <p className="text-[10px] font-mono text-[#2C1210]/50">#{idx + 1} of {tracks.length} · {fmt(elapsed)} / {current ? current.durationLabel : "—"}</p>
              </div>
            </div>
            <input type="range" min={0} max={current ? 210 : 0} step={1} value={Math.min(elapsed, 209)} onChange={seek} className="w-full accent-[#D90429]" aria-label="Seek" />
            <div className="flex items-center gap-2 text-xs text-[#2C1210]/70"><span>🔊</span><input type="range" min={0} max={1} step={0.05} defaultValue={0.8} onChange={setVol} className="flex-1 accent-amber-500" aria-label="Volume" /><span>80%</span></div>
          </div>
          <div className="px-4 py-3 border-b border-[#EAD5A0] flex items-center justify-between">
            <p className="font-serif font-black text-[#2C1210]">PLAYLIST ({tracks.length})</p>
          </div>
          <div className="flex gap-1.5 px-4 py-2 border-b border-[#EAD5A0]">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase ${tab === t ? "bg-[#2C1210] text-white" : "bg-stone-100 text-[#2C1210]/60"}`}>{t}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map((t, i) => {
              const realIdx = tracks.indexOf(t);
              return (
                <button key={i} onClick={() => play(realIdx)} className={`w-full text-left px-4 py-2.5 border-b border-[#EAD5A0]/50 ${realIdx === idx ? "bg-amber-50" : "hover:bg-stone-50"}`}>
                  <p className="font-serif font-bold text-sm text-[#2C1210] truncate"><span className="text-[#D90429] font-mono mr-1.5">{String(realIdx + 1).padStart(2, "0")}</span>{t.title}</p>
                  <p className="text-[10px] text-[#2C1210]/60 font-mono">{t.artist} · {t.durationLabel}</p>
                </button>
              );
            })}
          </div>
        </aside>
      )}
    </>
  );
}
