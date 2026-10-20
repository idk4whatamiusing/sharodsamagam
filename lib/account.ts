"use client";

/**
 * Client for the Sharodsamagam Worker.
 *
 * The Worker owns the account: Google OAuth, the AES-256-GCM session cookie
 * and the saved-items API. The browser never holds a user id - only the
 * encrypted session cookie, which is HttpOnly and unreadable from JS.
 */

export type Account = {
  id: string;
  email: string;
  name: string;
  picture: string;
};

export type SavedSets = {
  pandals: string[];
  trails: string[];
  routes: string[];
  liked: number[];
};

export const EMPTY_SAVES: SavedSets = { pandals: [], trails: [], routes: [], liked: [] };

export async function fetchAccount(): Promise<Account | null> {
  try {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (!res.ok) return null;
    const json = await res.json();
    return json.user || null;
  } catch {
    return null;
  }
}

export function signIn(next?: string) {
  const target = next ? `?next=${encodeURIComponent(next)}` : "";
  window.location.href = `/auth/google${target}`;
}

export async function signOut() {
  try {
    await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
  } catch {
    // The cookie is cleared server-side regardless; the reload is the fallback.
  }
  window.location.href = "/";
}

export async function fetchSaves(): Promise<SavedSets | null> {
  try {
    const res = await fetch("/api/saves", { credentials: "same-origin" });
    if (!res.ok) return null;
    return (await res.json()) as SavedSets;
  } catch {
    return null;
  }
}

/** Toggles one saved item. Returns the fresh save sets, or null when signed out. */
export async function toggleSave(
  kind: "pandal" | "trail" | "route" | "liked",
  id: string,
  value?: string | number
): Promise<{ saved: boolean; saves: SavedSets } | null> {
  try {
    const res = await fetch("/api/saves", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, id, value }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function postSuggestion(payload: {
  name: string;
  locality?: string;
  lat?: number;
  lng?: number;
  note?: string;
  photoId?: string;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/suggestions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function uploadPhoto(file: File, pandal: string, caption?: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("pandal", pandal);
  form.append("caption", caption || "");
  const res = await fetch("/api/uploads", { method: "POST", credentials: "same-origin", body: form });
  if (!res.ok) return null;
  return (await res.json()) as { ok: boolean; id: string; status: string };
}
