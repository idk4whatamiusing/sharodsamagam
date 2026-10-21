"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../components/AuthProvider";
import { fetchSaves, signIn, signOut, uploadPhoto } from "../../lib/account";
import type { SavedSets } from "../../lib/account";
import { Icon } from "../../components/map/ui";

const EMPTY: SavedSets = { pandals: [], trails: [], routes: [], liked: [] };

export default function ProfilePage() {
  const { account, ready } = useAuth();
  const [saves, setSaves] = useState<SavedSets>(EMPTY);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!account) return;
    fetchSaves().then((next) => {
      if (next) setSaves(next);
    });
  }, [account]);

  if (!ready) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-24 text-center font-mono text-xs text-[#B45309] sm:pt-28 lg:pt-32">
        Loading your profile...
      </main>
    );
  }

  if (!account) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-24 text-center sm:pt-28 lg:pt-32">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#D90429]/10 text-[#D90429]">
          <Icon name="users" size={24} />
        </span>
        <h1 className="font-serif text-2xl font-black text-[#2C1210]">Sign in to Sharodsamagam</h1>
        <p className="mx-auto mt-2 max-w-md font-sans text-sm leading-relaxed text-[#2C1210]/70">
          Your saved pandals, curated trails, liked routes and planned trips follow you across
          devices.
        </p>
        <button
          type="button"
          onClick={() => signIn("/profile")}
          className="mt-4 cursor-pointer rounded-full bg-[#D90429] px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#B50321]"
        >
          Sign in with Google
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-24 sm:pt-28 lg:pt-32">
      <div className="rounded-3xl border border-[#E5C880] bg-[#FFFBF0] p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          {account.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={account.picture}
              alt=""
              className="h-14 w-14 rounded-full border-2 border-[#E5C880] object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#E5C880] bg-[#FFF3D6] font-serif text-xl font-black text-[#D90429]">
              {(account.name || "P").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-[#B45309]">
              Sharodsamagam profile
            </p>
            <h1 className="font-serif text-xl font-black text-[#2C1210] sm:text-2xl">
              {account.name}
            </h1>
            <p className="truncate font-mono text-[11px] text-[#B45309]">{account.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="cursor-pointer rounded-full border border-[#E5C880] bg-white px-3 py-1.5 font-mono text-[10px] font-bold text-[#D90429] transition-colors hover:border-[#D90429]"
          >
            Sign out
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Saved pandals", saves.pandals.length],
            ["Saved trails", saves.trails.length],
            ["Saved routes", saves.routes.length],
            ["Liked routes", saves.liked.length],
          ].map(([label, count]) => (
            <div key={String(label)} className="rounded-2xl border border-[#E5C880] bg-white p-3">
              <p className="font-serif text-2xl font-black text-[#D90429]">{count}</p>
              <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#2C1210]/45">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-5 rounded-3xl border border-[#E5C880] bg-[#FFFBF0] p-5 sm:p-7">
        <h2 className="font-serif text-lg font-black text-[#2C1210]">Share a pandal photo</h2>
        <p className="mt-1 font-sans text-[12px] leading-relaxed text-[#2C1210]/65">
          Upload a photo of a pandal for the community archive. Every upload is queued for
          approval before it appears on the pandal's page.
        </p>
        <PhotoUpload onDone={(id) => setMessage(`Upload received. Reference ${id}.`)} />
        {message && (
          <p className="mt-2 rounded-lg border border-[#E5C880] bg-[#FFF3D6] px-2.5 py-1.5 font-mono text-[10px] text-[#B45309]">
            {message}
          </p>
        )}
      </section>

      {saves.pandals.length > 0 && (
        <section className="mt-5 rounded-3xl border border-[#E5C880] bg-[#FFFBF0] p-5 sm:p-7">
          <h2 className="font-serif text-lg font-black text-[#2C1210]">Saved pandals</h2>
          <ul className="mt-2 space-y-1">
            {saves.pandals.map((slug) => (
              <li key={slug}>
                <a
                  href={`/paras/${slug}`}
                  className="font-sans text-[12px] text-[#2C1210]/75 underline-offset-2 transition-colors hover:text-[#D90429] hover:underline"
                >
                  {slug.replace(/-/g, " ")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function PhotoUpload({ onDone }: { onDone: (id: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pandal, setPandal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!file) {
      setError("Choose a photo first.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await uploadPhoto(file, pandal.trim());
    setBusy(false);
    if (!result) {
      setError("The upload failed. Please try again.");
      return;
    }
    setFile(null);
    onDone(result.id);
  };

  return (
    <div className="mt-3 space-y-2">
      <input
        value={pandal}
        onChange={(event) => setPandal(event.target.value)}
        placeholder="Pandal name or slug"
        className="w-full rounded-lg border border-[#E5C880] bg-white px-3 py-2 font-sans text-[12px] text-[#2C1210] outline-none placeholder:text-[#2C1210]/35 focus:border-[#D90429]"
      />
      <input
        type="file"
        accept="image/*"
        onChange={(event) => setFile(event.target.files?.[0] || null)}
        className="w-full cursor-pointer rounded-lg border border-[#E5C880] bg-white px-3 py-2 font-mono text-[10px] text-[#2C1210]/60"
      />
      {error && (
        <p className="rounded-lg border border-[#D90429]/30 bg-[#FFF0F2] px-2.5 py-1.5 font-sans text-[10px] text-[#D90429]">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className="cursor-pointer rounded-full bg-[#D90429] px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#B50321] disabled:opacity-50"
      >
        {busy ? "Uploading..." : "Upload photo"}
      </button>
    </div>
  );
}
