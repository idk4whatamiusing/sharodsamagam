"use client";

import { useEffect, useRef, useState } from "react";

type Track = { title: string; artist: string; filename: string; durationLabel: string };

export default function AudioPlayer({ tracks }: { tracks: Track[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dhakRef = useRef<HTMLAudioElement | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dhakOn, setDhakOn] = useState(false);
  const [open, setOpen] = useState(false);

  const current = tracks[idx];

  useEffect(() => {
    if (!dhakRef.current) {
      dhakRef.current = new Audio("/sounds/dhak1.mp3");
      dhakRef.current.loop = true;
      dhakRef.current.volume = 0.5;
    }
    try {
      if (localStorage.getItem("dhak_pref") === "playing") {
        dhakRef.current.play().catch(() => {});
        setDhakOn(true);
      }
    } catch {}
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
    const d = dhakRef.current!;
    if (dhakOn) { d.pause(); setDhakOn(false); try { localStorage.setItem("dhak_pref", "muted"); } catch {} }
    else { d.play().catch(() => {}); setDhakOn(true); try { localStorage.setItem("dhak_pref", "playing"); } catch {} }
  };

  return (
    <>
      <audio ref={audioRef} onEnded={() => play((idx + 1) % tracks.length)} />

      {/* Floating dhak chip — matches original */}
      <button
        onClick={toggleDhak}
        aria-label={dhakOn ? "Mute Dhak sound" : "Play Dhak sound"}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-xl border border-[#EAD5A0] text-[11px] font-black uppercase font-mono tracking-wider bg-white/95 ${dhakOn ? "text-[#D90429]" : "text-[#2C1210]"}`}
      >
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${dhakOn ? "bg-[#D90429] text-white" : "bg-stone-100 text-[#2C1210]"}`}>🥁</span>
        <span className="hidden sm:inline">{dhakOn ? "Dhak Rhythm" : "Dhak Sound"}</span>
      </button>

      {/* Playlist toggle */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Playlist"
        className="fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full bg-white/95 border border-[#EAD5A0] shadow-xl flex items-center justify-center text-xl"
      >
        🎵
      </button>

      {open && (
        <div className="fixed top-0 right-0 bottom-0 w-80 z-50 bg-[#FFFDF5] border-l border-[#EAD5A0] shadow-2xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-[#EAD5A0]">
            <h3 className="font-serif font-black text-[#2C1210]">Festival Playlist</h3>
            <button onClick={() => setOpen(false)} className="text-[#2C1210]/60" aria-label="Close">✕</button>
          </div>
          <div className="flex items-center gap-3 p-4 border-b border-[#EAD5A0]">
            <button onClick={toggle} className="w-10 h-10 rounded-full bg-[#D90429] text-white font-bold">{playing ? "❚❚" : "▶"}</button>
            <div className="min-w-0">
              <p className="font-serif font-bold text-sm text-[#2C1210] truncate">{current ? current.title : "—"}</p>
              <p className="text-[10px] text-[#2C1210]/60 font-mono">{playing ? "Playing" : "Paused"} · {current ? current.durationLabel : ""}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tracks.map((t, i) => (
              <button key={i} onClick={() => play(i)} className={`w-full text-left px-4 py-2.5 border-b border-[#EAD5A0]/50 hover:bg-white ${i === idx ? "bg-[#FFB800]/20" : ""}`}>
                <p className="font-serif font-bold text-sm text-[#2C1210] truncate">{t.title}</p>
                <p className="text-[10px] text-[#2C1210]/60 font-mono">{t.artist} · {t.durationLabel}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
