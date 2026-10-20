"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { EMPTY_SAVES, fetchSaves, signIn, toggleSave } from "../lib/account";
import type { SavedSets } from "../lib/account";

/**
 * The signed-in user's saved items.
 *
 * Everything lives on the Worker: D1 holds the rows, KV caches the list for
 * five minutes. The browser keeps no copy - when signed out the sets are
 * empty and the save buttons ask the visitor to sign in.
 */
export function useSaves() {
  const { account, ready } = useAuth();
  const [saves, setSaves] = useState<SavedSets>(EMPTY_SAVES);

  useEffect(() => {
    let active = true;
    if (!ready) return;
    if (!account) {
      setSaves(EMPTY_SAVES);
      return;
    }
    fetchSaves().then((next) => {
      if (active && next) setSaves(next);
    });
    return () => {
      active = false;
    };
  }, [account, ready]);

  const toggle = useCallback(
    async (
      kind: "pandal" | "trail" | "route" | "liked",
      id: string,
      value?: string | number
    ) => {
      if (!account) {
        signIn(window.location.pathname);
        return { saved: false, ok: false };
      }
      const result = await toggleSave(kind, id, value);
      if (!result) return { saved: false, ok: false };
      setSaves(result.saves);
      return { saved: result.saved, ok: true };
    },
    [account]
  );

  return { saves, toggle, account, ready };
}
