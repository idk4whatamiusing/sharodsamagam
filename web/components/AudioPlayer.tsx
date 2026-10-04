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
  }, []);

  const play = (i: number) => {
    setIdx(i);
    setPlaying(true);
    const t = tracks[i];
    if (audioRef.current) {
      audioRef.current.src = `/Songs/${t.filename.split("/").pop()}`;
      audioRef.current.play().catch(() => {});
    }
  };

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      if (!audioRef.current.src) {
        play(0);
        return;
      }
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const toggleDhak = () => {
    const d = dhakRef.current!;
    if (dhakOn) { d.pause(); setDhakOn(false); } else { d.play().catch(() => {}); setDhakOn(true); }
  };

  return (
    <>
      <audio ref={audioRef} onEnded={() => play((idx + 1) % tracks.length)} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-[#2C1210] text-white border-t border-[#EAD5A0]/20">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 py-2">
          <button onClick={toggle} className="w-9 h-9 rounded-full bg-[#D90429] flex items-center justify-center font-bold" aria-label="Play/Pause">
            {playing ? "❚❚" : "▶"}
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-serif font-bold text-sm truncate">{current ? current.title : "Durga Puja Playlist"}</p>
            <p className="text-[10px] text-white/60 font-mono truncate">{current ? current.artist : ""}</p>
          </div>
          <button onClick={toggleDhak} className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase font-mono border ${dhakOn ? "bg-[#FFB800] text-[#2C1210] border-[#FFB800]" : "border-white/30 text-white/70"}`} aria-label="Toggle dhak layer">
            Dhak
          </button>
          <button onClick={() => setOpen(!open)} className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase font-mono border border-white/30 text-white/70" aria-label="Playlist">
            Playlist ({tracks.length})
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed bottom-14 right-3 z-50 w-80 max-h-96 overflow-y-auto rounded-2xl border border-[#EAD5A0] bg-white text-[#2C1210] shadow-2xl">
          {tracks.map((t, i) => (
            <button key={i} onClick={() => play(i)} className={`w-full text-left px-4 py-2.5 border-b border-[#EAD5A0]/50 hover:bg-[#FFFDF5] ${i === idx ? "bg-[#FFB800]/20" : ""}`}>
              <p className="font-serif font-bold text-sm truncate">{t.title}</p>
              <p className="text-[10px] text-[#2C1210]/60 font-mono">{t.artist} · {t.durationLabel}</p>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
